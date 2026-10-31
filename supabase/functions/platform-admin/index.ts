import { createClient } from "jsr:@supabase/supabase-js@2";

// platform-admin — platform-wide management of the assistant catalogue,
// per-organization switches and the central n8n connection.
// Contract: specs/019-platform-assistant-catalog/contracts/platform-admin.md
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// ALLOWED_ORIGINS (comma-separated; fail-closed CORS, never '*').
// The stored webhook token is write-only: it is never returned to the client.

// Secrets accept both the VITE_-prefixed names (as set in the project's
// secret panel) and the Supabase platform defaults.
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fail-closed CORS: only origins listed in ALLOWED_ORIGINS get an ACAO header.
function corsHeaders(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = req.headers.get("Origin");
  if (!origin || !allowed.includes(origin)) return base;
  return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

type ErrorCode = "VALIDATION" | "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: "Ongeldige invoer.",
  UNAUTHORIZED: "Uw sessie is verlopen. Log opnieuw in.",
  FORBIDDEN: "Alleen de platformbeheerder kan deze instelling wijzigen.",
  INTERNAL_ERROR: "Er ging iets mis. Probeer het opnieuw.",
};

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
};

function json(value: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function errorResponse(
  code: ErrorCode,
  cors: Record<string, string>,
  message?: string,
): Response {
  return json({ code, message: message ?? ERROR_MESSAGES[code] }, cors, STATUS_BY_CODE[code]);
}

// Log only code, action, ids and duration — never URLs, tokens or payloads.
function logCode(
  code: string,
  action: string,
  started: number,
  organizationId?: string,
  catalogId?: string,
) {
  console.error(
    JSON.stringify({
      code,
      action,
      organization_id: organizationId,
      catalog_id: catalogId,
      ms: Date.now() - started,
    }),
  );
}

// SSRF guard: https only, no literal IPs, localhost or link-local hosts.
function isAllowedWebhookUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal")
    ) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // literal IPv4
    if (host.includes(":")) return false; // literal IPv6
    return true;
  } catch {
    return false;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSISTANT_TYPES = ["chat", "agent", "voice", "risico_analyse"] as const;
const MAX_EXAMPLE_QUESTIONS = 4;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

type UrlResult = { ok: true; value: string | null } | { ok: false; message: string };

// Production URLs: https + SSRF guard + no n8n test path.
// Test URLs: same rules, but /webhook-test/ is allowed (stored only).
function normalizeUrl(raw: unknown, isProduction: boolean): UrlResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, message: ERROR_MESSAGES.VALIDATION };
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!isAllowedWebhookUrl(value)) {
    return { ok: false, message: "Voer een geldige https-URL in." };
  }
  if (isProduction && value.includes("/webhook-test/")) {
    return { ok: false, message: "Een productie-URL mag geen /webhook-test/ bevatten." };
  }
  return { ok: true, value };
}

interface StoredConfig {
  auth_header: string | null;
  token: string | null;
  document_webhook_url: string | null;
}

async function readStoredConfig(): Promise<StoredConfig | null> {
  const { data } = await serviceClient
    .from("platform_webhook_config")
    .select("auth_header, token, document_webhook_url")
    .eq("id", true)
    .maybeSingle();
  return (data as StoredConfig | null) ?? null;
}

interface AssistantUpdate {
  catalog_id: string;
  test_webhook_url: string | null;
  prod_webhook_url: string | null;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }
  if (req.method !== "POST") {
    return errorResponse("VALIDATION", cors);
  }

  const started = Date.now();

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const action = asString(body?.action);

    // --- AuthN: validate the caller's session JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("UNAUTHORIZED", cors);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return errorResponse("UNAUTHORIZED", cors);

    // --- AuthZ: only platform admins. The RPC runs with the caller's JWT so
    // is_platform_admin() evaluates auth.uid() for the actual caller.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: isPlatformAdmin, error: authzError } =
      await userClient.rpc("is_platform_admin");
    if (authzError) {
      logCode("INTERNAL_ERROR", action, started);
      return errorResponse("INTERNAL_ERROR", cors);
    }
    if (isPlatformAdmin !== true) {
      logCode("FORBIDDEN", action, started);
      return errorResponse("FORBIDDEN", cors);
    }

    switch (action) {
      // ---------------------------------------------------------------- orgs
      case "list_organizations": {
        const { data, error } = await serviceClient
          .from("organizations")
          .select("id, name")
          .order("name", { ascending: true });
        if (error) {
          logCode("INTERNAL_ERROR", action, started);
          return errorResponse("INTERNAL_ERROR", cors);
        }
        return json(data ?? [], cors);
      }

      // ------------------------------------------- assistants of one org
      case "list_org_assistants": {
        const organizationId = asString(body?.organization_id);
        if (!UUID_RE.test(organizationId)) {
          return errorResponse("VALIDATION", cors, "Onbekende organisatie.");
        }

        const { data: org, error: orgError } = await serviceClient
          .from("organizations")
          .select("id")
          .eq("id", organizationId)
          .maybeSingle();
        if (orgError) {
          logCode("INTERNAL_ERROR", action, started, organizationId);
          return errorResponse("INTERNAL_ERROR", cors);
        }
        if (!org) return errorResponse("VALIDATION", cors, "Onbekende organisatie.");

        const { data, error } = await serviceClient
          .from("ai_assistants")
          .select("id, catalog_id, is_active, assistant_catalog(name, icon, type)")
          .eq("organization_id", organizationId);
        if (error) {
          logCode("INTERNAL_ERROR", action, started, organizationId);
          return errorResponse("INTERNAL_ERROR", cors);
        }

        const rows = (data ?? []) as Array<{
          id: string;
          catalog_id: string;
          is_active: boolean;
          assistant_catalog: { name: string; icon: string; type: string } | null;
        }>;

        const assistants = rows
          .map((row) => ({
            assistant_id: row.id,
            catalog_id: row.catalog_id,
            name: row.assistant_catalog?.name ?? "",
            icon: row.assistant_catalog?.icon ?? "",
            type: row.assistant_catalog?.type ?? "",
            is_active: row.is_active,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "nl"));

        return json(assistants, cors);
      }

      // --------------------------------------------------- the org switch
      case "set_assistant_active": {
        const organizationId = asString(body?.organization_id);
        const catalogId = asString(body?.catalog_id);
        const isActive = body?.is_active;

        if (!UUID_RE.test(organizationId) || !UUID_RE.test(catalogId) ||
          typeof isActive !== "boolean") {
          return errorResponse("VALIDATION", cors);
        }

        const { data, error } = await serviceClient
          .from("ai_assistants")
          .update({ is_active: isActive })
          .eq("organization_id", organizationId)
          .eq("catalog_id", catalogId)
          .select("id");
        if (error) {
          logCode("INTERNAL_ERROR", action, started, organizationId, catalogId);
          return errorResponse("INTERNAL_ERROR", cors);
        }
        if (!data || data.length === 0) {
          return errorResponse("VALIDATION", cors, "Deze assistent hoort niet bij deze organisatie.");
        }
        return json({ ok: true }, cors);
      }

      // ------------------------------------------------------- connections
      case "get_connections": {
        const stored = await readStoredConfig();
        const { data: catalog, error } = await serviceClient
          .from("assistant_catalog")
          .select("id, name, type, test_webhook_url, prod_webhook_url")
          .order("name", { ascending: true });
        if (error) {
          logCode("INTERNAL_ERROR", action, started);
          return errorResponse("INTERNAL_ERROR", cors);
        }

        return json({
          auth_header: stored?.auth_header || "X-Webhook-Token",
          has_token: !!stored?.token,
          document_webhook_url: stored?.document_webhook_url ?? null,
          assistants: (catalog ?? []).map((row) => ({
            catalog_id: row.id,
            name: row.name,
            type: row.type,
            test_webhook_url: row.test_webhook_url ?? null,
            prod_webhook_url: row.prod_webhook_url ?? null,
          })),
        }, cors);
      }

      case "save_connections": {
        const authHeaderName = asString(body?.auth_header) || "X-Webhook-Token";
        const newToken = asString(body?.token);

        const documentUrl = normalizeUrl(body?.document_webhook_url, true);
        if (!documentUrl.ok) return errorResponse("VALIDATION", cors, documentUrl.message);

        const rawAssistants = Array.isArray(body?.assistants) ? body.assistants : null;
        if (!rawAssistants) return errorResponse("VALIDATION", cors);

        const updates: AssistantUpdate[] = [];
        for (const item of rawAssistants) {
          if (!item || typeof item !== "object") {
            return errorResponse("VALIDATION", cors);
          }
          const entry = item as Record<string, unknown>;
          const catalogId = asString(entry.catalog_id);
          if (!UUID_RE.test(catalogId)) return errorResponse("VALIDATION", cors);

          const testUrl = normalizeUrl(entry.test_webhook_url, false);
          if (!testUrl.ok) return errorResponse("VALIDATION", cors, testUrl.message);
          const prodUrl = normalizeUrl(entry.prod_webhook_url, true);
          if (!prodUrl.ok) return errorResponse("VALIDATION", cors, prodUrl.message);

          updates.push({
            catalog_id: catalogId,
            test_webhook_url: testUrl.value,
            prod_webhook_url: prodUrl.value,
          });
        }

        const stored = await readStoredConfig();

        // Validate every catalogue id before writing anything, so an unknown
        // assistant cannot leave a partially saved connection.
        if (updates.length > 0) {
          const catalogIds = [...new Set(updates.map((update) => update.catalog_id))];
          const { data: existing, error: existingError } = await serviceClient
            .from("assistant_catalog")
            .select("id")
            .in("id", catalogIds);
          if (existingError) {
            logCode("INTERNAL_ERROR", action, started);
            return errorResponse("INTERNAL_ERROR", cors);
          }
          if ((existing ?? []).length !== catalogIds.length) {
            return errorResponse("VALIDATION", cors, "Een assistent bestaat niet meer.");
          }
        }

        const configUpdate: Record<string, unknown> = {
          id: true,
          auth_header: authHeaderName,
          document_webhook_url: documentUrl.value,
        };
        // Empty/absent token keeps the existing one (write-only semantics).
        if (newToken) configUpdate.token = newToken;

        const { error: configError } = await serviceClient
          .from("platform_webhook_config")
          .upsert(configUpdate, { onConflict: "id" });
        if (configError) {
          logCode("INTERNAL_ERROR", action, started);
          return errorResponse("INTERNAL_ERROR", cors);
        }

        for (const update of updates) {
          const { error } = await serviceClient
            .from("assistant_catalog")
            .update({
              test_webhook_url: update.test_webhook_url,
              prod_webhook_url: update.prod_webhook_url,
            })
            .eq("id", update.catalog_id);
          if (error) {
            logCode("INTERNAL_ERROR", action, started, undefined, update.catalog_id);
            return errorResponse("INTERNAL_ERROR", cors);
          }
        }

        return json({ ok: true, has_token: newToken ? true : !!stored?.token }, cors);
      }

      case "test_connection": {
        const target = normalizeUrl(body?.url, true);
        if (!target.ok) return errorResponse("VALIDATION", cors, target.message);
        if (!target.value) return errorResponse("VALIDATION", cors, "Voer een geldige https-URL in.");

        const stored = await readStoredConfig();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const storedToken = stored?.token?.trim() ?? "";
        if (storedToken) {
          headers[stored?.auth_header || "X-Webhook-Token"] = storedToken;
        }

        // Same probe as the former flow-config test action.
        const payload = {
          test: true,
          timestamp: new Date().toISOString(),
          assistant: { id: "test", name: "Connectivity Test", system_prompt: "test" },
          knowledge_bases: [],
          knowledgeSourceName: "",
          tenantId: "test",
          conversation: { id: "test", history: [] },
          message: "__test_connection__",
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        let upstream: Response;
        try {
          upstream = await fetch(target.value, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } catch {
          const message = controller.signal.aborted
            ? "Time-out: de webhook reageert niet binnen 10 seconden. Controleer of de n8n-workflow actief is."
            : "Kon geen verbinding maken met de webhook. Controleer of de URL bereikbaar is.";
          logCode(
            controller.signal.aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE",
            action,
            started,
          );
          return json({ ok: false, status: 0, message }, cors);
        } finally {
          clearTimeout(timer);
        }

        if (upstream.ok) {
          return json({
            ok: true,
            status: upstream.status,
            message: "Verbinding geslaagd! De webhook is bereikbaar en accepteert verzoeken.",
          }, cors);
        }

        if (upstream.status === 500) {
          return json({
            ok: true,
            status: upstream.status,
            message:
              "Webhook bereikbaar! De workflow gaf een fout (500) bij het testbericht — dit is normaal. Zorg dat uw n8n-workflow een IF-node heeft die testberichten afhandelt.",
          }, cors);
        }

        let message: string;
        if (upstream.status === 401) {
          message =
            "Authenticatiefout (401). Controleer of het secret en de headernaam overeenkomen met de n8n-webhookinstellingen.";
        } else if (upstream.status === 403) {
          message =
            "Webhook geweigerd (403). Controleer of het secret correct is en de headernaam (bijvoorbeeld X-Webhook-Token) overeenkomt met de n8n-webhookinstellingen.";
        } else if (upstream.status === 404) {
          message = "Webhook niet gevonden (404). Controleer de URL en of de n8n-workflow actief is.";
        } else if (upstream.status === 429) {
          message = "Te veel verzoeken (429). Wacht even en probeer het opnieuw.";
        } else {
          message = `Onverwachte fout (${upstream.status}). Controleer de webhookconfiguratie.`;
        }
        logCode("UPSTREAM_ERROR", action, started);
        return json({ ok: false, status: upstream.status, message }, cors);
      }

      // ----------------------------------------------------------- catalogue
      case "save_catalog_assistant": {
        const rawId = body?.id;
        const catalogId = rawId === null || rawId === undefined ? null : asString(rawId);
        if (catalogId !== null && !UUID_RE.test(catalogId)) {
          return errorResponse("VALIDATION", cors, "Deze assistent bestaat niet meer.");
        }

        const name = asString(body?.name);
        if (!name) return errorResponse("VALIDATION", cors, "Vul een naam in.");

        const type = asString(body?.type);
        if (!ASSISTANT_TYPES.includes(type as typeof ASSISTANT_TYPES[number])) {
          return errorResponse("VALIDATION", cors);
        }

        const icon = asString(body?.icon) || "🤖";
        const description = asStringOrNull(body?.description);

        const rawQuestions = Array.isArray(body?.example_questions)
          ? body.example_questions
          : [];
        const questions = rawQuestions
          .map((q) => typeof q === "string" ? q.trim() : "")
          .filter(Boolean);
        if (questions.length > MAX_EXAMPLE_QUESTIONS) {
          return errorResponse(
            "VALIDATION",
            cors,
            `Maximaal ${MAX_EXAMPLE_QUESTIONS} voorbeeldvragen.`,
          );
        }

        const { data: savedId, error } = await serviceClient.rpc(
          "platform_save_catalog_assistant",
          {
            p_id: catalogId,
            p_name: name,
            p_description: description,
            p_icon: icon,
            p_type: type,
            p_example_questions: questions,
            p_actor: user.id,
          },
        );

        if (error) {
          const message = error.message ?? "";
          const isValidation = message.includes("name_required") ||
            message.includes("invalid_type") ||
            message.includes("too_many_example_questions") ||
            message.includes("not_found");
          logCode(isValidation ? "VALIDATION" : "INTERNAL_ERROR", action, started, undefined, catalogId ?? undefined);
          if (isValidation) {
            return errorResponse(
              "VALIDATION",
              cors,
              message.includes("not_found") ? "Deze assistent bestaat niet meer." : undefined,
            );
          }
          return errorResponse("INTERNAL_ERROR", cors);
        }

        return json({ catalog_id: savedId }, cors);
      }

      default:
        return errorResponse("VALIDATION", cors);
    }
  } catch {
    // Log code and duration only — error messages can embed URLs (constitution III).
    console.error(JSON.stringify({ code: "INTERNAL_ERROR", ms: Date.now() - started }));
    return errorResponse("INTERNAL_ERROR", cors);
  }
});
