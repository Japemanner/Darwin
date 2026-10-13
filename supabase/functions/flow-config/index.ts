import { createClient } from "jsr:@supabase/supabase-js@2";

// flow-config — server-side get/save/test for the n8n webhook configuration.
// Contract: specs/009-secure-n8n-proxy/contracts/flow-config.md
// The stored token is never returned to the client (write-only).
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// ALLOWED_ORIGINS (comma-separated; fail-closed CORS, never '*').

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client: flow_configs reads/writes, auth.getUser.
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

type FlowType = "rag_chat" | "document_processing";

const FLOW_TYPES: FlowType[] = ["rag_chat", "document_processing"];

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
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}

function errorResponse(code: string, message: string, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Log only action, flow_type, organization id, code and duration — never
// token values or fetch errors that embed the webhook URL (constitution III).
function logCode(code: string, action: string, flowType: string, orgId: string | undefined, started: number) {
  console.error(JSON.stringify({ code, action, flow_type: flowType, organization_id: orgId, ms: Date.now() - started }));
}

interface StoredConfig {
  id: string;
  webhook_url: string;
  webhook_auth_header: string;
  webhook_token: string;
}

async function readStoredConfig(flowType: FlowType, organizationId: string): Promise<StoredConfig | null> {
  const { data } = await serviceClient
    .from("flow_configs")
    .select("id, webhook_url, webhook_auth_header, webhook_token")
    .eq("flow_type", flowType)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return (data as StoredConfig | null) ?? null;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }
  if (req.method !== "POST") {
    return errorResponse("VALIDATION", "Ongeldige aanroep.", 405, cors);
  }

  const started = Date.now();

  try {
    const body = await req.json().catch(() => null) as {
      action?: string;
      flow_type?: string;
      webhook_url?: string;
      webhook_auth_header?: string;
      webhook_token?: string;
    } | null;

    const action = body?.action ?? "";
    const flowType = body?.flow_type as FlowType | undefined;

    if (!["get", "save", "test"].includes(action) || !flowType || !FLOW_TYPES.includes(flowType)) {
      return errorResponse("VALIDATION", "Ongeldige invoer.", 400, cors);
    }

    // --- AuthN: validate the caller's session JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("UNAUTHORIZED", "Uw sessie is verlopen. Log opnieuw in.", 401, cors);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return errorResponse("UNAUTHORIZED", "Uw sessie is verlopen. Log opnieuw in.", 401, cors);

    // User-context client: forwards the caller's JWT so RLS applies. The
    // organization comes exclusively from the profiles row of auth.uid().
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: profile } = await userClient
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();

    // --- AuthZ: admins only.
    if (!profile?.organization_id || profile.role !== "admin") {
      logCode("FORBIDDEN", action, flowType, profile?.organization_id, started);
      return errorResponse("FORBIDDEN", "U heeft geen beheerdersrechten voor deze instelling.", 403, cors);
    }
    const organizationId = profile.organization_id;

    if (action === "get") {
      const stored = await readStoredConfig(flowType, organizationId);
      return new Response(JSON.stringify({
        flow_type: flowType,
        webhook_url: stored?.webhook_url ?? "",
        webhook_auth_header: stored?.webhook_auth_header ?? "X-Webhook-Token",
        has_token: !!stored?.webhook_token,
      }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (action === "save") {
      const webhookUrl = body?.webhook_url?.trim() ?? "";
      const authHeaderName = body?.webhook_auth_header?.trim() || "X-Webhook-Token";
      const newToken = body?.webhook_token?.trim() ?? "";

      if (!webhookUrl) {
        return errorResponse("VALIDATION", "Voer een geldige https-URL in.", 400, cors);
      }
      if (!isAllowedWebhookUrl(webhookUrl)) {
        return errorResponse("VALIDATION", "Voer een geldige https-URL in.", 400, cors);
      }

      const stored = await readStoredConfig(flowType, organizationId);
      if (stored) {
        // Empty/absent token keeps the existing one (write-only semantics).
        const updates: Record<string, string> = {
          webhook_url: webhookUrl,
          webhook_auth_header: authHeaderName,
        };
        if (newToken) updates.webhook_token = newToken;
        const { error: updateError } = await serviceClient
          .from("flow_configs")
          .update(updates)
          .eq("id", stored.id);
        if (updateError) {
          logCode("INTERNAL_ERROR", action, flowType, organizationId, started);
          return errorResponse("INTERNAL_ERROR", "Er ging iets mis bij het opslaan. Probeer het opnieuw.", 500, cors);
        }
      } else {
        const { error: insertError } = await serviceClient
          .from("flow_configs")
          .insert({
            flow_type: flowType,
            organization_id: organizationId,
            webhook_url: webhookUrl,
            webhook_auth_header: authHeaderName,
            webhook_token: newToken,
          });
        if (insertError) {
          logCode("INTERNAL_ERROR", action, flowType, organizationId, started);
          return errorResponse("INTERNAL_ERROR", "Er ging iets mis bij het opslaan. Probeer het opnieuw.", 500, cors);
        }
      }

      return new Response(JSON.stringify({ ok: true, has_token: newToken ? true : !!(await readStoredConfig(flowType, organizationId))?.webhook_token }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // --- action === "test": connectivity test, ported from testWebhook.
    const webhookUrl = body?.webhook_url?.trim() ?? "";
    const authHeaderName = body?.webhook_auth_header?.trim() || "X-Webhook-Token";
    const typedToken = body?.webhook_token?.trim() ?? "";

    if (!webhookUrl) {
      return errorResponse("VALIDATION", "Voer een geldige https-URL in.", 400, cors);
    }
    if (!isAllowedWebhookUrl(webhookUrl)) {
      return errorResponse("VALIDATION", "Voer een geldige https-URL in.", 400, cors);
    }

    // The stored token is only used for the stored URL; a different URL
    // requires the admin to re-enter the token (no token exfiltration).
    const stored = await readStoredConfig(flowType, organizationId);
    let testToken: string | undefined;
    if (typedToken) {
      testToken = typedToken;
    } else if (stored?.webhook_token && stored.webhook_url === webhookUrl) {
      testToken = stored.webhook_token;
    } else {
      return new Response(JSON.stringify({
        ok: false,
        status: 0,
        message: "Voer het token in om een andere URL te testen.",
      }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (webhookUrl.includes("/webhook-test/")) {
      return new Response(JSON.stringify({
        ok: false,
        status: 0,
        message: "Dit is een n8n test-URL (/webhook-test/). Gebruik de productie-URL (/webhook/) voor live assistenten.",
      }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (testToken) headers[authHeaderName] = testToken;

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
      upstream = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      const message = controller.signal.aborted
        ? "Time-out: de webhook reageert niet binnen 10 seconden. Controleer of de n8n workflow actief is."
        : "Kon geen verbinding maken met de webhook. Controleer of de URL bereikbaar is.";
      logCode(controller.signal.aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE", action, flowType, organizationId, started);
      return new Response(JSON.stringify({ ok: false, status: 0, message }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    } finally {
      clearTimeout(timer);
    }

    if (upstream.ok) {
      return new Response(JSON.stringify({
        ok: true,
        status: upstream.status,
        message: "Verbinding geslaagd! De webhook is bereikbaar en accepteert verzoeken.",
      }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (upstream.status === 500) {
      return new Response(JSON.stringify({
        ok: true,
        status: upstream.status,
        message: "Webhook bereikbaar! De workflow gaf een fout (500) bij het testbericht — dit is normaal. Zorg dat je n8n workflow een IF-node heeft die test-berichten afhandelt.",
      }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    let message: string;
    if (upstream.status === 401) {
      message = "Authenticatiefout (401). Controleer of het token en de header naam overeenkomen met de n8n webhook instellingen.";
    } else if (upstream.status === 403) {
      message = "Webhook geweigerd (403). Controleer of het token correct is en de header naam (bijv. X-Webhook-Token) overeenkomt met de n8n webhook instellingen.";
    } else if (upstream.status === 404) {
      message = "Webhook niet gevonden (404). Controleer de URL en of de n8n workflow actief is.";
    } else if (upstream.status === 429) {
      message = "Te veel verzoeken (429). Wacht even en probeer opnieuw.";
    } else {
      message = `Onverwachte fout (${upstream.status}). Controleer de webhook configuratie.`;
    }
    logCode("UPSTREAM_ERROR", action, flowType, organizationId, started);
    return new Response(JSON.stringify({ ok: false, status: upstream.status, message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch {
    console.error(JSON.stringify({ code: "INTERNAL_ERROR", ms: Date.now() - started }));
    return errorResponse("INTERNAL_ERROR", "Er ging iets mis. Probeer het opnieuw.", 500, cors);
  }
});