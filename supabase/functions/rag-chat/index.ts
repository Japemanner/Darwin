import { createClient } from "jsr:@supabase/supabase-js@2";

// rag-chat — server-side proxy for the n8n RAG chat webhook.
// Contract: specs/009-secure-n8n-proxy/contracts/rag-chat.md
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// ALLOWED_ORIGINS (comma-separated; fail-closed CORS, never '*').

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client: only for flow_configs reads and auth.getUser.
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
  FORBIDDEN: "U heeft geen toegang tot deze assistent of dit gesprek.",
  NOT_CONFIGURED: "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder.",
  UPSTREAM_AUTH: "De koppeling weigert de verbinding. Controleer het token en de headernaam in de instellingen.",
  UPSTREAM_ERROR: "De assistent-service gaf een fout. Probeer het opnieuw of neem contact op met de beheerder.",
  UPSTREAM_TIMEOUT: "De assistant reageert niet binnen de toegestane tijd. Probeer het opnieuw.",
  UPSTREAM_UNREACHABLE: "Kon geen verbinding maken met de assistent-service.",
  INTERNAL_ERROR: "Er ging iets mis bij het ophalen van het antwoord. Probeer het opnieuw.",
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

// Log only code, ids and duration — never message, answer or history
// (constitution III).
function logCode(
  code: string,
  assistantId: string | undefined,
  conversationId: string | undefined,
  started: number,
) {
  console.error(
    JSON.stringify({
      code,
      assistant_id: assistantId,
      conversation_id: conversationId,
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

interface NormalizedResponse {
  answer: string;
  sources: Array<Record<string, unknown>> | null;
  verification: { grounded: boolean; confidence: number; issues: string[] } | null;
  rewritten_query: string | null;
}

// Port of extractWebhookResponse (src/lib/webhook.ts): handles n8n array/object
// shapes and the legacy `response` field.
function pickFirstItem(raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    const item = raw[0];
    return item && typeof item === "object" ? item as Record<string, unknown> : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && value.length > 0) {
        const item = value[0];
        if (item && typeof item === "object" && ("answer" in item || "response" in item)) {
          return item as Record<string, unknown>;
        }
      }
    }
    return obj;
  }
  return null;
}

function normalizeWebhookResponse(raw: unknown): NormalizedResponse {
  const item = pickFirstItem(raw);
  const answer =
    typeof item?.answer === "string" ? item.answer
      : typeof item?.response === "string" ? item.response
      : "Geen antwoord ontvangen";
  const sources = Array.isArray(item?.sources) ? item.sources as Array<Record<string, unknown>> : null;
  const verification = item && typeof item.verification_grounded === "boolean"
    ? {
        grounded: item.verification_grounded as boolean,
        confidence: typeof item.verification_confidence === "number" ? item.verification_confidence : 0,
        issues: Array.isArray(item.verification_issues) ? item.verification_issues as string[] : [],
      }
    : null;
  const rewrittenQuery = typeof item?.rewritten_query === "string" ? item.rewritten_query : null;
  return { answer, sources, verification, rewritten_query: rewrittenQuery };
}

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
      assistant_id?: string;
      conversation_id?: string;
      message?: string;
    } | null;
    const assistantId = body?.assistant_id?.trim() ?? "";
    const conversationId = body?.conversation_id?.trim() ?? "";
    const message = body?.message?.trim() ?? "";

    if (!assistantId || !conversationId || !message) {
      return errorResponse("VALIDATION", cors);
    }
    if (message.length > 10_000) {
      return new Response(
        JSON.stringify({ code: "VALIDATION", message: "Uw bericht is te lang (maximaal 10.000 tekens)." }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } },
      );
    }

    // --- AuthN: validate the caller's session JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("UNAUTHORIZED", cors);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return errorResponse("UNAUTHORIZED", cors);

    // User-context client: forwards the caller's JWT so RLS applies to all
    // domain reads. The organization comes exclusively from the profiles row
    // of auth.uid() — never from the request body or user metadata.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: profile } = await userClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) return errorResponse("FORBIDDEN", cors);
    const organizationId = profile.organization_id;

    // --- AuthZ: assistant (RLS scopes to the caller's org), must be active.
    const { data: assistant } = await userClient
      .from("ai_assistants")
      .select("id, name, system_prompt, type, is_active, n8n_webhook_url, organization_id")
      .eq("id", assistantId)
      .maybeSingle();
    if (!assistant || !assistant.is_active || assistant.organization_id !== organizationId) {
      return errorResponse("FORBIDDEN", cors);
    }

    // --- AuthZ: conversation belongs to the caller and to this assistant.
    const { data: conversation } = await userClient
      .from("conversations")
      .select("id, user_id, assistant_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversation || conversation.user_id !== user.id || conversation.assistant_id !== assistantId) {
      return errorResponse("FORBIDDEN", cors);
    }

    // --- Knowledge bases linked to the assistant (RLS-scoped).
    const { data: kbLinks } = await userClient
      .from("assistant_knowledge_bases")
      .select("knowledge_bases(id, name, vector_collection_id)")
      .eq("assistant_id", assistantId);
    const knowledgeBases = (kbLinks ?? [])
      .map((row: { knowledge_bases: Record<string, unknown> | null }) => row.knowledge_bases)
      .filter((kb): kb is Record<string, unknown> => !!kb)
      .map((kb) => ({
        id: kb.id as string,
        name: kb.name as string,
        vector_collection_id: (kb.vector_collection_id as string | null) ?? "",
      }));

    // --- Organization name as tenant id (server-resolved).
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    const tenantId = (org?.name as string | undefined) ?? organizationId;

    // --- Webhook URL selection, exactly as callRagWebhook did:
    // type 'chat' -> org flow config, falling back to the assistant URL;
    // other types -> assistant URL only. No URL -> NOT_CONFIGURED.
    let webhookUrl = "";
    let authHeaderName = "X-Webhook-Token";
    let webhookToken: string | undefined;

    if (assistant.type === "chat") {
      const { data: config } = await serviceClient
        .from("flow_configs")
        .select("webhook_url, webhook_auth_header, webhook_token")
        .eq("flow_type", "rag_chat")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (config?.webhook_url) {
        webhookUrl = config.webhook_url;
        authHeaderName = config.webhook_auth_header || "X-Webhook-Token";
        webhookToken = config.webhook_token || undefined;
      }
    }
    if (!webhookUrl && assistant.n8n_webhook_url) {
      webhookUrl = assistant.n8n_webhook_url;
      authHeaderName = "X-Webhook-Token";
      webhookToken = undefined;
    }
    if (!webhookUrl || !isAllowedWebhookUrl(webhookUrl)) {
      logCode("NOT_CONFIGURED", assistantId, conversationId, started);
      return errorResponse("NOT_CONFIGURED", cors);
    }

    // --- History: last 20 messages of this conversation (RLS-scoped).
    const { data: historyRows } = await userClient
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);
    const history = (historyRows ?? [])
      .map((row: { role: string; content: string }) => ({ role: row.role, content: row.content }))
      .reverse();

    const payload = {
      assistant: {
        id: assistant.id as string,
        name: assistant.name as string,
        system_prompt: (assistant.system_prompt as string | null) ?? "",
      },
      knowledge_bases: knowledgeBases,
      knowledge_sources: knowledgeBases.map((kb) => kb.name),
      knowledgeSourceName: knowledgeBases.map((kb) => kb.name).join(", "),
      tenantId,
      conversation: { id: conversationId, history },
      message,
    };

    // --- Call n8n (60s timeout). n8n never receives the Supabase JWT.
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhookToken) headers[authHeaderName] = webhookToken;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    let upstream: Response;
    try {
      upstream = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        logCode("UPSTREAM_TIMEOUT", assistantId, conversationId, started);
        return errorResponse("UPSTREAM_TIMEOUT", cors);
      }
      logCode("UPSTREAM_UNREACHABLE", assistantId, conversationId, started);
      return errorResponse("UPSTREAM_UNREACHABLE", cors);
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status === 401 || upstream.status === 403) {
      logCode("UPSTREAM_AUTH", assistantId, conversationId, started);
      return errorResponse("UPSTREAM_AUTH", cors);
    }
    if (!upstream.ok) {
      logCode("UPSTREAM_ERROR", assistantId, conversationId, started);
      return errorResponse("UPSTREAM_ERROR", cors);
    }

    const raw = await upstream.json().catch(() => null);
    const normalized = normalizeWebhookResponse(raw);

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch {
    // Log code and duration only — error messages can embed URLs (constitution III).
    console.error(JSON.stringify({ code: "INTERNAL_ERROR", ms: Date.now() - started }));
    return errorResponse("INTERNAL_ERROR", cors);
  }
});