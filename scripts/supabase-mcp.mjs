#!/usr/bin/env node
/**
 * Launcher for the official Supabase MCP server.
 *
 * OpenCode v2 does not forward a local MCP server's `environment` block to the
 * child process, so the personal access token cannot be injected from
 * opencode.json. This wrapper reads it from `.env.local` (gitignored) instead,
 * which also keeps the secret out of the config file, argv and process logs.
 *
 * Used by the "supabase" entry in opencode.json:
 *   "command": ["node", "scripts/supabase-mcp.mjs"]
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = process.env.SUPABASE_PROJECT_REF ?? "ddfjigrjwlfpaljhhogv";

function loadDotEnvLocal() {
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — fall back to the inherited environment.
  }
}

if (!process.env.SUPABASE_ACCESS_TOKEN) loadDotEnvLocal();

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    "supabase-mcp: SUPABASE_ACCESS_TOKEN is missing. Add it to .env.local or your environment."
  );
  process.exit(1);
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["-y", "@supabase/mcp-server-supabase@latest", `--project-ref=${projectRef}`],
  {
    stdio: "inherit",
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    shell: process.platform === "win32",
  }
);

child.on("error", (error) => {
  console.error(`supabase-mcp: failed to start MCP server: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
