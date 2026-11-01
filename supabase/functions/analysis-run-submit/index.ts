import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

// analysis-run-submit — starts a risk-analysis run through the server route.
// Contract: specs/021-analysis-server-route/contracts/analysis-run-submit.md
//
// The browser sends multipart/form-data with the real files. This function
// validates session, organization, assistant and input, records the run, and
// posts JSON with base64 files to the production webhook from the assistant
// catalogue using the central header/token. n8n never sees the Supabase JWT.

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CALLBACK_SECRET = Deno.env.get("ANALYSIS_CALLBACK_SECRET") ?? "";

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE_BYTES = 25 * 1024 * 1024;
// 25 MB of files plus multipart boundaries and form fields.
const MAX_REQUEST_SIZE_BYTES = 30 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_CONFIGURED"
  | "CONFLICT"
  | "FILE_TOO_LARGE"
  | "GROUP_VALIDATION"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNREACHABLE"
  | "INTERNAL_ERROR";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: "Controleer de ingevulde gegevens.",
  UNAUTHORIZED: "Uw sessie is verlopen. Log opnieuw in.",
  FORBIDDEN: "Deze assistent is niet beschikbaar voor een analyse.",
  NOT_CONFIGURED: "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.",
  CONFLICT: "De analyse kon niet worden gestart. Probeer het opnieuw.",
  FILE_TOO_LARGE: "De bestanden overschrijden de toegestane grootte.",
  GROUP_VALIDATION: "Vul minimaal één van Klantsituatie, Bestanden of URL’s in.",
  UPSTREAM_AUTH: "De koppeling weigert de verbinding. Controleer het token en de headernaam in de instellingen.",
  UPSTREAM_ERROR: "De analyseservice gaf een fout. Probeer het opnieuw of neem contact op met de beheerder.",
  UPSTREAM_TIMEOUT: "De analyseservice reageert niet binnen de toegestane tijd. Probeer het opnieuw.",
  UPSTREAM_UNREACHABLE: "Kon geen verbinding maken met de analyseservice.",
  INTERNAL_ERROR: "Er ging iets mis bij het starten van de analyse. Probeer het opnieuw.",
};

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_CONFIGURED: 400,
  CONFLICT: 409,
  FILE_TOO_LARGE: 413,
  GROUP_VALIDATION: 422,
  UPSTREAM_AUTH: 502,
  UPSTREAM_ERROR: 502,
  UPSTREAM_TIMEOUT: 502,
  UPSTREAM_UNREACHABLE: 502,
  INTERNAL_ERROR: 500,
};

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

function errorResponse(
  code: ErrorCode,
  cors: Record<string, string>,
  message?: string,
  status?: number,
): Response {
  return new Response(JSON.stringify({ code, message: message ?? ERROR_MESSAGES[code] }), {
    status: status ?? STATUS_BY_CODE[code],
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Log only code, run id and duration — never client content (constitution III).
function logCode(code: string, runId: string | undefined, started: number) {
  console.error(JSON.stringify({ code, run_id: runId, ms: Date.now() - started }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function failRun(runId: string, code: string, message: string) {
  return serviceClient
    .from("analysis_runs")
    .update({
      status: "failed",
      error_code: code,
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }
  if (req.method !== "POST") {
    return errorResponse("VALIDATION", cors, undefined, 405);
  }

  const started = Date.now();
  let insertedRunId: string | undefined;

  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE_BYTES) {
      return errorResponse("FILE_TOO_LARGE", cors);
    }

    const form = await req.formData().catch(() => null);
    if (!form) return errorResponse("VALIDATION", cors, "Ongeldige aanvraag.");

    const value = (name: string): string | undefined => {
      const entry = form.get(name);
      return typeof entry === "string" ? entry : undefined;
    };

    const runId = value("run_id")?.trim() ?? "";
    const assistantId = value("assistant_id")?.trim() ?? "";
    const verzekeringsvraagstuk = value("verzekeringsvraagstuk")?.trim() ?? "";
    const klantsituatie = value("klantsituatie")?.trim() ?? "";
    const klantRef = value("klant_ref")?.trim() ?? "";

    if (!UUID_RE.test(runId) || !UUID_RE.test(assistantId)) {
      return errorResponse("VALIDATION", cors, "Ongeldige uitvoering of assistent.");
    }
    if (!verzekeringsvraagstuk || !klantRef) {
      return errorResponse("VALIDATION", cors, "Vul het verzekeringsvraagstuk en de klantreferentie in.");
    }

    let requestedKbs: Array<{ id: string }> | null = null;
    try {
      const parsed = JSON.parse(value("kennisbronnen") ?? "null");
      if (Array.isArray(parsed)) {
        requestedKbs = parsed
          .filter((item): item is { id: string } =>
            !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
          )
          .map((item) => ({ id: item.id }));
      }
    } catch {
      requestedKbs = null;
    }
    if (!requestedKbs || requestedKbs.length === 0) {
      return errorResponse("VALIDATION", cors, "Selecteer minimaal één kennisbron.");
    }

    let urls: string[] = [];
    try {
      const parsed = JSON.parse(value("urls") ?? "[]");
      if (Array.isArray(parsed)) urls = parsed.filter((u): u is string => typeof u === "string");
      else return errorResponse("VALIDATION", cors, "Ongeldige URL-lijst.");
    } catch {
      return errorResponse("VALIDATION", cors, "Ongeldige URL-lijst.");
    }
    if (urls.some((url) => !isHttpsUrl(url))) {
      return errorResponse("VALIDATION", cors, "URL’s moeten beginnen met https://");
    }

    const files = form.getAll("bestanden").filter((entry): entry is File => entry instanceof File);
    for (const file of files) {
      if (!ALLOWED_EXTENSIONS.has(extensionOf(file.name))) {
        return errorResponse("VALIDATION", cors, `Alleen pdf, docx en txt zijn toegestaan: ${file.name}`);
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return errorResponse("FILE_TOO_LARGE", cors, `Bestand overschrijdt de limiet van 10 MB: ${file.name}`);
      }
    }
    const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalFileSize > MAX_TOTAL_FILE_SIZE_BYTES) {
      return errorResponse("FILE_TOO_LARGE", cors, "De totale bestandsgrootte overschrijdt 25 MB.");
    }
    if (!klantsituatie && files.length === 0 && urls.length === 0) {
      return errorResponse("GROUP_VALIDATION", cors);
    }

    // --- AuthN: validate the caller's session JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("UNAUTHORIZED", cors);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return errorResponse("UNAUTHORIZED", cors);

    // --- Organization and advisor name come exclusively from profiles.
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) return errorResponse("FORBIDDEN", cors);
    const organizationId = profile.organization_id as string;

    // --- Assistant must exist, be active, be a risk analysis and belong to
    // the caller's organization.
    const { data: assistant } = await serviceClient
      .from("ai_assistants")
      .select("id, type, is_active, organization_id, catalog_id")
      .eq("id", assistantId)
      .maybeSingle();
    if (
      !assistant || !assistant.is_active || assistant.type !== "risico_analyse" ||
      assistant.organization_id !== organizationId
    ) {
      return errorResponse("FORBIDDEN", cors);
    }

    // --- Production URL from the catalogue, header/secret from the platform row.
    if (!assistant.catalog_id) return errorResponse("NOT_CONFIGURED", cors);
    const [{ data: catalog }, { data: globalConfig }] = await Promise.all([
      serviceClient
        .from("assistant_catalog")
        .select("prod_webhook_url")
        .eq("id", assistant.catalog_id)
        .maybeSingle(),
      serviceClient
        .from("platform_webhook_config")
        .select("auth_header, token")
        .eq("id", true)
        .maybeSingle(),
    ]);

    const webhookUrl = (catalog?.prod_webhook_url as string | null) ?? "";
    if (!webhookUrl || !isAllowedWebhookUrl(webhookUrl)) {
      logCode("NOT_CONFIGURED", runId, started);
      return errorResponse("NOT_CONFIGURED", cors);
    }
    const authHeaderName = (globalConfig?.auth_header as string | undefined) || "X-Webhook-Token";
    const webhookToken = (globalConfig?.token as string | undefined) || "";
    if (!CALLBACK_SECRET) {
      logCode("INTERNAL_ERROR", runId, started);
      return errorResponse("INTERNAL_ERROR", cors);
    }

    // --- Resolve the selected knowledge sources server-side: only sources
    // linked to this assistant and belonging to the caller's organization.
    const { data: kbLinks } = await serviceClient
      .from("assistant_knowledge_bases")
      .select("knowledge_bases(id, name, organization_id)")
      .eq("assistant_id", assistantId);
    const available = new Map<string, { id: string; name: string }>();
    for (const row of kbLinks ?? []) {
      const kb = (row as {
        knowledge_bases: { id: string; name: string; organization_id: string } | null;
      }).knowledge_bases;
      if (kb && kb.organization_id === organizationId) {
        available.set(kb.id, { id: kb.id, name: kb.name });
      }
    }
    const resolvedKbs: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();
    for (const item of requestedKbs) {
      if (seen.has(item.id)) continue;
      const kb = available.get(item.id);
      if (!kb) {
        return errorResponse("VALIDATION", cors, "Een geselecteerde kennisbron is niet beschikbaar.");
      }
      seen.add(item.id);
      resolvedKbs.push(kb);
    }

    // --- Record the run before dispatching to n8n.
    const { error: insertError } = await serviceClient.from("analysis_runs").insert({
      id: runId,
      assistant_id: assistantId,
      advisor_id: user.id,
      organization_id: organizationId,
      client_reference: klantRef,
      status: "queued",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (insertError) {
      if (insertError.code === "23505") return errorResponse("CONFLICT", cors);
      logCode("INTERNAL_ERROR", runId, started);
      return errorResponse("INTERNAL_ERROR", cors);
    }
    insertedRunId = runId;

    const sig = await hmacHex(CALLBACK_SECRET, runId);
    const callbackUrl =
      `${SUPABASE_URL}/functions/v1/analysis-run-callback?run_id=${encodeURIComponent(runId)}&sig=${sig}`;

    const bestanden = await Promise.all(files.map(async (file) => {
      const extension = extensionOf(file.name);
      return {
        naam: file.name,
        type: file.type || MIME_BY_EXTENSION[extension] || "application/octet-stream",
        data: encodeBase64(new Uint8Array(await file.arrayBuffer())),
      };
    }));

    const payload = {
      run_id: runId,
      callback_url: callbackUrl,
      verzekeringsvraagstuk,
      kennisbronnen: resolvedKbs,
      klantsituatie,
      bestanden,
      urls,
      klant_ref: klantRef,
      adviseur: (profile.full_name as string | null) ?? "",
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhookToken) headers[authHeaderName] = webhookToken;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let upstream: Response;
    try {
      upstream = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        await failRun(runId, "UPSTREAM_TIMEOUT", ERROR_MESSAGES.UPSTREAM_TIMEOUT);
        logCode("UPSTREAM_TIMEOUT", runId, started);
        return errorResponse("UPSTREAM_TIMEOUT", cors);
      }
      await failRun(runId, "UPSTREAM_UNREACHABLE", ERROR_MESSAGES.UPSTREAM_UNREACHABLE);
      logCode("UPSTREAM_UNREACHABLE", runId, started);
      return errorResponse("UPSTREAM_UNREACHABLE", cors);
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status === 202) {
      await serviceClient
        .from("analysis_runs")
        .update({ status: "running" })
        .eq("id", runId);
      return jsonResponse({ run_id: runId }, 202, cors);
    }

    const code: ErrorCode = upstream.status === 401 || upstream.status === 403
      ? "UPSTREAM_AUTH"
      : "UPSTREAM_ERROR";
    await failRun(runId, code, ERROR_MESSAGES[code]);
    logCode(code, runId, started);
    return errorResponse(code, cors);
  } catch {
    if (insertedRunId) {
      try {
        await failRun(insertedRunId, "INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
      } catch {
        // Best effort: the original error is reported below.
      }
    }
    logCode("INTERNAL_ERROR", insertedRunId, started);
    return errorResponse("INTERNAL_ERROR", cors);
  }
});
