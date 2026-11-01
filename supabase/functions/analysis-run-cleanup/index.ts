import { createClient } from "jsr:@supabase/supabase-js@2";

// analysis-run-cleanup — daily removal of expired runs and their dossiers.
// Contract: specs/021-analysis-server-route/contracts/analysis-run-cleanup.md
//
// Called by pg_cron via pg_net, protected by x-cleanup-secret. Objects are
// removed through the Storage API (a SQL delete of storage.objects would leave
// the physical files orphaned), then the rows are deleted.

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLEANUP_SECRET = Deno.env.get("ANALYSIS_CLEANUP_SECRET") ?? "";

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = "analysis-dossiers";
const MAX_RUNS_PER_CALL = 1000;
const REMOVE_BATCH_SIZE = 100;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function logCode(code: string, deleted: number, failed: number, started: number) {
  console.error(JSON.stringify({ code, deleted, failed, ms: Date.now() - started }));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    if (!CLEANUP_SECRET) {
      logCode("INTERNAL_ERROR", 0, 0, started);
      return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
    }
    const provided = req.headers.get("x-cleanup-secret") ?? "";
    if (!provided || !timingSafeEqual(provided, CLEANUP_SECRET)) {
      logCode("UNAUTHORIZED", 0, 0, started);
      return jsonResponse({ code: "UNAUTHORIZED" }, 401);
    }

    const { data: runs, error: selectError } = await serviceClient
      .from("analysis_runs")
      .select("id, dossier_path")
      .lt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(MAX_RUNS_PER_CALL);

    if (selectError) {
      logCode("INTERNAL_ERROR", 0, 0, started);
      return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
    }

    const rows = (runs ?? []) as Array<{ id: string; dossier_path: string | null }>;
    if (rows.length === 0) {
      return jsonResponse({ deleted: 0, failed: 0 }, 200);
    }

    // Remove the dossier objects first, in batches. A failed batch is retried
    // on the next daily run; its rows are left in place.
    const removed = new Set<string>();
    const paths = rows
      .map((row) => row.dossier_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);

    for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
      const batch = paths.slice(index, index + REMOVE_BATCH_SIZE);
      const { error } = await serviceClient.storage.from(BUCKET).remove(batch);
      if (!error) {
        for (const path of batch) removed.add(path);
      }
    }

    const deletableIds = rows
      .filter((row) => !row.dossier_path || removed.has(row.dossier_path))
      .map((row) => row.id);

    let deleted = 0;
    if (deletableIds.length > 0) {
      for (let index = 0; index < deletableIds.length; index += REMOVE_BATCH_SIZE) {
        const batch = deletableIds.slice(index, index + REMOVE_BATCH_SIZE);
        const { error: deleteError } = await serviceClient
          .from("analysis_runs")
          .delete()
          .in("id", batch);
        if (deleteError) {
          logCode("INTERNAL_ERROR", deleted, rows.length - deleted, started);
          return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
        }
        deleted += batch.length;
      }
    }

    const failed = rows.length - deleted;
    logCode("OK", deleted, failed, started);
    return jsonResponse({ deleted, failed }, 200);
  } catch {
    logCode("INTERNAL_ERROR", 0, 0, started);
    return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
  }
});
