import { createClient } from "jsr:@supabase/supabase-js@2";

// document-webhook — server-side proxy for the n8n document processing webhook.
// Contract: specs/009-secure-n8n-proxy/contracts/document-webhook.md
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// ALLOWED_ORIGINS (comma-separated; fail-closed CORS, never '*').

// Secrets accept both the VITE_-prefixed names (as set in the project's
// secret panel) and the Supabase platform defaults.
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client: platform_webhook_config reads, org name lookup, signed URL creation.
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

type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_CONFIGURED"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNREACHABLE"
  | "INTERNAL_ERROR";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: "Ongeldige aanroep.",
  UNAUTHORIZED: "Uw sessie is verlopen. Log opnieuw in.",
  FORBIDDEN: "U heeft geen toegang tot dit document.",
  NOT_CONFIGURED: "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.",
  UPSTREAM_AUTH: "De koppeling weigert de verbinding. Controleer het token en de headernaam in de instellingen.",
  UPSTREAM_ERROR: "De documentverwerking gaf een fout. Probeer het opnieuw of neem contact op met de beheerder.",
  UPSTREAM_TIMEOUT: "De documentverwerking reageert niet binnen de toegestane tijd. Probeer het opnieuw.",
  UPSTREAM_UNREACHABLE: "Kon geen verbinding maken met de documentverwerking.",
  INTERNAL_ERROR: "Er ging iets mis bij het melden van de documentwijziging. Probeer het opnieuw.",
};

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_CONFIGURED: 400,
  UPSTREAM_AUTH: 502,
  UPSTREAM_ERROR: 502,
  UPSTREAM_TIMEOUT: 502,
  UPSTREAM_UNREACHABLE: 502,
  INTERNAL_ERROR: 500,
};

function errorResponse(code: ErrorCode, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ code, message: ERROR_MESSAGES[code] }), {
    status: STATUS_BY_CODE[code],
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Log only code, document id, action and duration — never document names,
// signed URLs or fetch errors that embed the webhook URL (constitution III).
function logCode(code: string, documentId: string | undefined, action: string | undefined, started: number) {
  console.error(
    JSON.stringify({ code, document_id: documentId, action, ms: Date.now() - started }),
  );
}

// Status transitions are service-role only: clients have no UPDATE policy on
// knowledge_base_documents (migration 015). Returns false when the write fails
// so the caller can surface a typed error instead of continuing silently.
async function setDocumentStatus(
  documentId: string,
  status: "processing" | "error",
  errorMessage: string | null,
): Promise<boolean> {
  const { error } = await serviceClient
    .from("knowledge_base_documents")
    .update({ status, error_message: errorMessage })
    .eq("id", documentId);
  return !error;
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
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}

const DOCUMENT_ACTIONS = ["index", "modify", "delete"] as const;
type DocumentAction = (typeof DOCUMENT_ACTIONS)[number];

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ code: "VALIDATION", message: ERROR_MESSAGES.VALIDATION }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const started = Date.now();

  try {
    const body = await req.json().catch(() => null) as {
      document_id?: string;
      action?: string;
    } | null;
    const documentId = body?.document_id?.trim() ?? "";
    const action = body?.action?.trim() as DocumentAction | undefined;

    if (!documentId || !action || !DOCUMENT_ACTIONS.includes(action)) {
      return errorResponse("VALIDATION", cors);
    }

    // --- AuthN: validate the caller's session JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("UNAUTHORIZED", cors);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return errorResponse("UNAUTHORIZED", cors);

    // User-context client: forwards the caller's JWT so RLS applies. The
    // organization comes exclusively from the profiles row of auth.uid() —
    // never from the request body or user metadata.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: profile } = await userClient
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) return errorResponse("FORBIDDEN", cors);

    // Index/re-index is a management action (feature 010/016).
    const isIndex = action === "index";
    if (isIndex && profile.role !== "admin") return errorResponse("FORBIDDEN", cors);

    const organizationId = profile.organization_id;

    // --- AuthZ: document row (RLS enforces organization_id = caller's org).
    const { data: document } = await userClient
      .from("knowledge_base_documents")
      .select("id, name, file_type, file_path, knowledge_bases(name)")
      .eq("id", documentId)
      .maybeSingle();
    if (!document) return errorResponse("FORBIDDEN", cors);

    const kbName = (document.knowledge_bases?.name as string | undefined) ?? "";
    const organizationName = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle()
      .then(({ data }) => (data?.name as string | undefined) ?? organizationId);

    // --- Central n8n connection (feature 019), service-role read.
    const { data: config } = await serviceClient
      .from("platform_webhook_config")
      .select("document_webhook_url, auth_header, token")
      .eq("id", true)
      .maybeSingle();
    if (!config?.document_webhook_url || !isAllowedWebhookUrl(config.document_webhook_url)) {
      if (isIndex) await setDocumentStatus(documentId, "error", ERROR_MESSAGES.NOT_CONFIGURED);
      logCode("NOT_CONFIGURED", documentId, action, started);
      return errorResponse("NOT_CONFIGURED", cors);
    }

    // --- Signed download URL for index/modify (server-side, 900 s).
    let downloadUrl = "";
    if (action !== "delete" && document.file_path) {
      const { data: signed, error: signedError } = await serviceClient.storage
        .from("knowledge-documents")
        .createSignedUrl(document.file_path, 900);
      if (signedError || !signed?.signedUrl) {
        if (isIndex) await setDocumentStatus(documentId, "error", ERROR_MESSAGES.INTERNAL_ERROR);
        logCode("INTERNAL_ERROR", documentId, action, started);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      downloadUrl = signed.signedUrl;
    }

    // --- Payload identical to the previous callDocumentWebhook.
    const payload = {
      action,
      tenantId: organizationName,
      knowledgeSourceName: kbName,
      document_id: documentId,
      document_name: (document.name as string | null) ?? "",
      document_type: ((document.file_type as string | null) ?? "unknown").toLowerCase(),
      file_path: (document.file_path as string | null) ?? "",
      download_url: downloadUrl,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.token) headers[config.auth_header || "X-Webhook-Token"] = config.token;

    // Start the visible retry state before n8n is called. On any failure below
    // the row goes back to 'error' with a reason, so polling can stop and the
    // admin can retry again (no permanent 'processing' limbo).
    if (isIndex && !(await setDocumentStatus(documentId, "processing", null))) {
      logCode("INTERNAL_ERROR", documentId, action, started);
      return errorResponse("INTERNAL_ERROR", cors);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let upstream: Response;
    try {
      upstream = await fetch(config.document_webhook_url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      const code = controller.signal.aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE";
      if (isIndex) await setDocumentStatus(documentId, "error", ERROR_MESSAGES[code]);
      logCode(code, documentId, action, started);
      return errorResponse(code, cors);
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status === 401 || upstream.status === 403) {
      if (isIndex) await setDocumentStatus(documentId, "error", ERROR_MESSAGES.UPSTREAM_AUTH);
      logCode("UPSTREAM_AUTH", documentId, action, started);
      return errorResponse("UPSTREAM_AUTH", cors);
    }
    if (!upstream.ok) {
      if (isIndex) await setDocumentStatus(documentId, "error", ERROR_MESSAGES.UPSTREAM_ERROR);
      logCode("UPSTREAM_ERROR", documentId, action, started);
      return errorResponse("UPSTREAM_ERROR", cors);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch {
    console.error(JSON.stringify({ code: "INTERNAL_ERROR", ms: Date.now() - started }));
    return errorResponse("INTERNAL_ERROR", cors);
  }
});