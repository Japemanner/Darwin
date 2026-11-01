import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// analysis-run-callback — the only way a run can finish.
// Contract: specs/021-analysis-server-route/contracts/analysis-run-callback.md
//
// Deploy with --no-verify-jwt: n8n has no Supabase JWT. Authenticity comes from
// the HMAC over run_id in the query string, created by analysis-run-submit.

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CALLBACK_SECRET = Deno.env.get("ANALYSIS_CALLBACK_SECRET") ?? "";

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Mirrors src/lib/analysis-schemas.ts (single source of truth: 008
// contracts/analysis-schema.md). The Edge Function cannot import from src/.
const BronRefSchema = z.object({
  id: z.string().regex(/^[KRA][0-9]+$/),
  document: z.string().min(1),
  locatie: z.string().min(1),
  passage: z.string().min(1),
});

const OptieSchema = z.object({
  titel: z.string().min(1),
  voor: z.array(z.string().min(1)),
  tegen: z.array(z.string().min(1)),
});

const AnalysisResultSchema = z.object({
  risicos: z.array(z.string().min(1)),
  dekking: z.string().min(1),
  restgat: z.string().min(1),
  draagkracht: z.string().min(1),
  opties: z.array(OptieSchema),
  lacunes: z.array(z.string().min(1)),
  intern_signalen: z.array(z.string().min(1)),
  bronnen: z.array(BronRefSchema),
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Log only run id, code and duration — never result content (constitution III).
function logCode(code: string, runId: string | undefined, started: number) {
  console.error(JSON.stringify({ code, run_id: runId, ms: Date.now() - started }));
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function markInvalidResult(runId: string): Promise<Response> {
  const { data, error } = await serviceClient
    .from("analysis_runs")
    .update({
      status: "failed",
      error_code: "INVALID_RESULT",
      error_message: "Het resultaat van de analyse was ongeldig. Probeer het opnieuw.",
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .in("status", ["queued", "running"])
    .select("id");
  if (error) return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
  if (!data || data.length === 0) return jsonResponse({ code: "CONFLICT" }, 409);
  return jsonResponse({ run_id: runId, status: "failed", code: "INVALID_RESULT" }, 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }
  if (req.method !== "POST") {
    return jsonResponse({ code: "VALIDATION" }, 405);
  }

  const started = Date.now();

  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get("run_id")?.trim() ?? "";
    const sig = url.searchParams.get("sig")?.trim() ?? "";

    if (!UUID_RE.test(runId) || !sig) {
      return jsonResponse({ code: "UNAUTHORIZED" }, 401);
    }
    if (!CALLBACK_SECRET) {
      logCode("INTERNAL_ERROR", runId, started);
      return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
    }

    const expected = await hmacHex(CALLBACK_SECRET, runId);
    if (!timingSafeEqual(expected, sig)) {
      logCode("UNAUTHORIZED", runId, started);
      return jsonResponse({ code: "UNAUTHORIZED" }, 401);
    }

    const { data: run } = await serviceClient
      .from("analysis_runs")
      .select("id, status, organization_id, advisor_id")
      .eq("id", runId)
      .maybeSingle();

    // Unknown or already finished: reject without writing (409).
    if (!run || (run.status !== "queued" && run.status !== "running")) {
      logCode("CONFLICT", runId, started);
      return jsonResponse({ code: "CONFLICT" }, 409);
    }

    const contentType = req.headers.get("content-type") ?? "";

    // --- Error callback (JSON).
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null) as
        | { run_id?: string; status?: string; code?: string; message?: string }
        | null;
      if (!body || (body.run_id && body.run_id !== runId) || body.status !== "error") {
        return jsonResponse({ code: "VALIDATION" }, 400);
      }

      const errorCode = (body.code ?? "N8N_WORKFLOW_ERROR").toString().slice(0, 120) || "N8N_WORKFLOW_ERROR";
      const errorMessage = (body.message ?? "De analyse is mislukt. Probeer het opnieuw.")
        .toString()
        .slice(0, 2000);

      const { data, error } = await serviceClient
        .from("analysis_runs")
        .update({
          status: "failed",
          error_code: errorCode,
          error_message: errorMessage,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .in("status", ["queued", "running"])
        .select("id");
      if (error) {
        logCode("INTERNAL_ERROR", runId, started);
        return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
      }
      if (!data || data.length === 0) {
        logCode("CONFLICT", runId, started);
        return jsonResponse({ code: "CONFLICT" }, 409);
      }
      return jsonResponse({ run_id: runId, status: "failed" }, 200);
    }

    // --- Success callback (multipart/form-data).
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (!form) return jsonResponse({ code: "VALIDATION" }, 400);

      const bodyRunId = form.get("run_id");
      const status = form.get("status");
      if (typeof bodyRunId === "string" && bodyRunId !== runId) {
        return jsonResponse({ code: "VALIDATION" }, 400);
      }
      if (status !== "ok") {
        return jsonResponse({ code: "VALIDATION" }, 400);
      }

      const analyseRaw = form.get("analyse");
      const internMarkdown = form.get("intern_markdown");
      const dossier = form.get("dossier_docx");

      if (
        typeof analyseRaw !== "string" ||
        typeof internMarkdown !== "string" ||
        !internMarkdown.trim() ||
        !(dossier instanceof File) ||
        dossier.size === 0
      ) {
        logCode("INVALID_RESULT", runId, started);
        return await markInvalidResult(runId);
      }

      let analyse: unknown = null;
      try {
        analyse = JSON.parse(analyseRaw);
      } catch {
        analyse = null;
      }
      const parsed = AnalysisResultSchema.safeParse(analyse);
      if (!parsed.success) {
        logCode("INVALID_RESULT", runId, started);
        return await markInvalidResult(runId);
      }

      const organizationId = run.organization_id as string;
      const advisorId = run.advisor_id as string;
      const path = `${organizationId}/${advisorId}/${runId}.docx`;

      const { error: uploadError } = await serviceClient.storage
        .from("analysis-dossiers")
        .upload(path, dossier, { contentType: DOCX_MIME, upsert: true });
      if (uploadError) {
        logCode("INTERNAL_ERROR", runId, started);
        return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
      }

      const { data, error } = await serviceClient
        .from("analysis_runs")
        .update({
          status: "succeeded",
          result_json: parsed.data,
          intern_markdown: internMarkdown,
          dossier_path: path,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .in("status", ["queued", "running"])
        .select("id");

      if (error) {
        const { data: current } = await serviceClient
          .from("analysis_runs")
          .select("status, dossier_path")
          .eq("id", runId)
          .maybeSingle();
        if (!(current?.status === "succeeded" && current.dossier_path === path)) {
          await serviceClient.storage.from("analysis-dossiers").remove([path]);
        }
        logCode("INTERNAL_ERROR", runId, started);
        return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
      }
      if (!data || data.length === 0) {
        const { data: current } = await serviceClient
          .from("analysis_runs")
          .select("status, dossier_path")
          .eq("id", runId)
          .maybeSingle();
        if (!(current?.status === "succeeded" && current.dossier_path === path)) {
          await serviceClient.storage.from("analysis-dossiers").remove([path]);
        }
        logCode("CONFLICT", runId, started);
        return jsonResponse({ code: "CONFLICT" }, 409);
      }

      return jsonResponse({ run_id: runId, status: "ok" }, 200);
    }

    return jsonResponse({ code: "VALIDATION" }, 400);
  } catch {
    logCode("INTERNAL_ERROR", undefined, started);
    return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
  }
});
