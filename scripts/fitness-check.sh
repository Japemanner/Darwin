#!/usr/bin/env bash
#
# Architecture fitness check script — Darwin project
# Runs grep/file checks for the pre-commit hook and @fitness-checker.
#
# Checks that are SKIPPED here:
#   F-01  RLS on all tables              → requires Supabase MCP
#   F-10  Storage bucket policies         → requires Supabase MCP
#   F-16  Snyk SAST                       → requires Snyk MCP
#   F-17  Snyk SCA (dependencies)         → requires Snyk MCP
#
# All other checks (F-02 through F-09, F-11 through F-15) run here as grep/file probes.
#
# Output: machine-readable JSON on stdout.
#   - "status" per check: PASS, FAIL, WARN, or SKIP
#   - "detail" per check: human-readable explanation
#   - Exit code 0 if no FAIL checks, 1 if any FAIL.
#

set -euo pipefail

declare -A STATUS=()
declare -A DETAIL=()

fail_count=0
warn_count=0
pass_count=0
skip_count=0

fail()     { STATUS["$1"]="FAIL"; DETAIL["$1"]="$2"; fail_count=$((fail_count + 1)); }
warn()     { STATUS["$1"]="WARN"; DETAIL["$1"]="$2"; warn_count=$((warn_count + 1)); }
pass()     { STATUS["$1"]="PASS"; DETAIL["$1"]="$2"; pass_count=$((pass_count + 1)); }
skip()     { STATUS["$1"]="SKIP"; DETAIL["$1"]="$2"; skip_count=$((skip_count + 1)); }

# ─── MCP-only checks (always SKIP) ───────────────────────────────────
skip "F-01" "Requires Supabase MCP — run @fitness-checker"
skip "F-10" "Requires Supabase MCP — run @fitness-checker"
skip "F-16" "Requires Snyk MCP — run @fitness-checker"
skip "F-17" "Requires Snyk MCP — run @fitness-checker"

# ──────────────────────────────────────────────────────────────────────
# F-02: No service_role keyword in frontend source
# ──────────────────────────────────────────────────────────────────────
if [ -d src ]; then
  hits=$(grep -rl --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -i 'service_role' src/ 2>/dev/null || true)
  if [ -n "$hits" ]; then
    fail "F-02" "service_role found in: $(echo "$hits" | tr '\n' ' ')"
  else
    pass "F-02" "No service_role in src/"
  fi
else
  warn "F-02" "src/ directory does not exist yet"
fi

# ──────────────────────────────────────────────────────────────────────
# F-03: Single Supabase client instance (createClient called exactly once in src/)
# ──────────────────────────────────────────────────────────────────────
if [ -d src ]; then
  count=$(grep -rl --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git 'createClient' src/ 2>/dev/null | wc -l | tr -d ' ' || echo "0")
  if [ "$count" -eq 0 ]; then
    warn "F-03" "createClient() not found in src/ yet"
  elif [ "$count" -eq 1 ]; then
    pass "F-03" "createClient() found 1 time"
  else
    fail "F-03" "createClient() found $count times — must be exactly 1"
  fi
else
  warn "F-03" "src/ directory does not exist yet"
fi

# ──────────────────────────────────────────────────────────────────────
# F-04: PKCE flow configured
# ──────────────────────────────────────────────────────────────────────
if [ -d src ]; then
  hits=$(grep -rl --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git 'flowType.*pkce\|:.*pkce' src/ 2>/dev/null || true)
  if [ -n "$hits" ]; then
    pass "F-04" "flowType: 'pkce' found"
  else
    fail "F-04" "PKCE flow not found in src/"
  fi
else
  warn "F-04" "src/ directory does not exist yet"
fi

# ──────────────────────────────────────────────────────────────────────
# F-05: Netlify SPA redirect present in netlify.toml
# ──────────────────────────────────────────────────────────────────────
if [ -f netlify.toml ]; then
  if grep -q 'from.*=.*"/*"' netlify.toml 2>/dev/null && grep -q 'to.*=.*"/index.html"' netlify.toml 2>/dev/null; then
    pass "F-05" "SPA redirect present in netlify.toml"
  else
    fail "F-05" "SPA redirect (/* → /index.html) missing in netlify.toml"
  fi
else
  fail "F-05" "netlify.toml does not exist"
fi

# ──────────────────────────────────────────────────────────────────────
# F-06: TypeScript strict mode
# ──────────────────────────────────────────────────────────────────────
if [ -f tsconfig.json ]; then
  if grep -q '"strict".*true' tsconfig.json 2>/dev/null; then
    pass "F-06" "strict: true in tsconfig.json"
  else
    fail "F-06" "strict: true not found in tsconfig.json"
  fi
else
  fail "F-06" "tsconfig.json does not exist"
fi

# ──────────────────────────────────────────────────────────────────────
# F-07: tsc --noEmit compiles cleanly
# ──────────────────────────────────────────────────────────────────────
if [ -f tsconfig.json ]; then
  if command -v npx >/dev/null 2>&1; then
    if npx tsc --noEmit 2>/dev/null; then
      pass "F-07" "0 errors"
    else
      fail "F-07" "TypeScript compilation errors found"
    fi
  else
    skip "F-07" "npx not available"
  fi
else
  warn "F-07" "tsconfig.json does not exist — nothing to compile"
fi

# ──────────────────────────────────────────────────────────────────────
# F-08: No unjustified `any` types
# ──────────────────────────────────────────────────────────────────────
if [ -d src ]; then
  any_hits=$(grep -rn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git ': any\|:any' src/ 2>/dev/null || true)
  any_count=$(echo "$any_hits" | grep -c . 2>/dev/null || echo "0")
  if [ "$any_count" -eq 0 ]; then
    pass "F-08" "No :any annotations found"
  else
    # Count lines without @ts-expect-error above them
    # This is approximate: checks if a line with `: any` has `@ts-expect-error` on the line immediately before
    unjustified=0
    prev_line=""
    while IFS= read -r line; do
      if echo "$line" | grep -q ': any'; then
        case "$prev_line" in
          *@ts-expect-error* | *@ts-ignore*) ;;
          *) unjustified=$((unjustified + 1)) ;;
        esac
      fi
      prev_line="$line"
    done <<< "$any_hits"
    if [ "$unjustified" -gt 0 ]; then
      warn "F-08" "$unjustified of $any_count ':any' usage(s) lack @ts-expect-error suppression"
    else
      pass "F-08" "$any_count ':any' usage(s) — all have suppression comments"
    fi
  fi
else
  warn "F-08" "src/ directory does not exist yet"
fi

# ──────────────────────────────────────────────────────────────────────
# F-09: No Supabase admin client in frontend
# ──────────────────────────────────────────────────────────────────────
if [ -d src ]; then
  hits=$(grep -rl --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -E 'supabase\..*admin|service_role.*key|createClient.*service|adminClient' src/ 2>/dev/null || true)
  if [ -n "$hits" ]; then
    fail "F-09" "Admin client usage found in: $(echo "$hits" | tr '\n' ' ')"
  else
    pass "F-09" "No admin client in src/"
  fi
else
  warn "F-09" "src/ directory does not exist yet"
fi

# ──────────────────────────────────────────────────────────────────────
# F-11: No waitForTimeout in tests
# ──────────────────────────────────────────────────────────────────────
if [ -d tests ]; then
  hits=$(grep -rl 'waitForTimeout' tests/ 2>/dev/null || true)
  if [ -n "$hits" ]; then
    fail "F-11" "waitForTimeout found in: $(echo "$hits" | tr '\n' ' ')"
  else
    pass "F-11" "No waitForTimeout in tests/"
  fi
else
  warn "F-11" "tests/ directory does not exist yet"
fi

# ──────────────────────────────────────────────────────────────────────
# F-12: .env.local in .gitignore
# ──────────────────────────────────────────────────────────────────────
if [ -f .gitignore ]; then
  if grep -q '.env.local' .gitignore 2>/dev/null; then
    pass "F-12" ".env.local is in .gitignore"
  else
    fail "F-12" ".env.local missing from .gitignore"
  fi
else
  fail "F-12" ".gitignore does not exist"
fi

# ──────────────────────────────────────────────────────────────────────
# F-13: .env.example exists
# ──────────────────────────────────────────────────────────────────────
if [ -f .env.example ]; then
  pass "F-13" ".env.example exists"
else
  fail "F-13" ".env.example does not exist"
fi

# ──────────────────────────────────────────────────────────────────────
# F-14: No direct DOM manipulation (getElementById, querySelector, innerHTML)
# ──────────────────────────────────────────────────────────────────────
if [ -d src ]; then
  hits=$(grep -rn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -E 'document\.getElementById|document\.querySelector|\.innerHTML' src/ 2>/dev/null || true)
  if [ -n "$hits" ]; then
    fail "F-14" "Direct DOM manipulation found: $(echo "$hits" | tr '\n' '; ')"
  else
    pass "F-14" "No direct DOM manipulation in src/"
  fi
else
  warn "F-14" "src/ directory does not exist yet"
fi

# ──────────────────────────────────────────────────────────────────────
# F-15: Conventional commits (last 5 commits)
# ──────────────────────────────────────────────────────────────────────
if [ -d .git ]; then
  nonconv=$(mktemp)
  # Conventional commit pattern: type(scope): or type: or merge/branch
  pattern='^(feat|fix|test|chore|refactor|docs|style|perf|ci|build|revert)(\([^)]+\))?:'
  git log -5 --format='%s' 2>/dev/null | while IFS= read -r msg; do
    if ! echo "$msg" | grep -qE "$pattern" 2>/dev/null; then
      if ! echo "$msg" | grep -qE '^Merge |^Initial ' 2>/dev/null; then
        echo "$msg" >> "$nonconv"
      fi
    fi
  done
  if [ -s "$nonconv" ]; then
    warn "F-15" "Non-conventional commits: $(tr '\n' '; ' < "$nonconv")"
  else
    pass "F-15" "Last 5 commits are conventional"
  fi
  rm -f "$nonconv"
else
  warn "F-15" ".git directory not found"
fi

# ─── Output JSON ─────────────────────────────────────────────────────

echo "{"
echo "  \"summary\": {"
echo "    \"fail\": $fail_count,"
echo "    \"warn\": $warn_count,"
echo "    \"pass\": $pass_count,"
echo "    \"skip\": $skip_count"
echo "  },"
echo "  \"checks\": ["

first=true
for id in F-01 F-02 F-03 F-04 F-05 F-06 F-07 F-08 F-09 F-10 F-11 F-12 F-13 F-14 F-15 F-16 F-17; do
  if [ "$first" = true ]; then first=false; else echo ","; fi
  printf '    { "id": "%s", "status": "%s", "detail": "%s" }' "$id" "${STATUS[$id]}" "$(echo "${DETAIL[$id]}" | sed 's/"/\\"/g')"
done

echo ""
echo "  ]"
echo "}"

if [ "$fail_count" -gt 0 ]; then
  exit 1
else
  exit 0
fi
