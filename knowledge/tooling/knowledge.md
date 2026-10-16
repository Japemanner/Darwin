# Tooling (Windows / WSL / Git / hooks) — kennis

Feiten en patronen (bevestigd door waarneming, tenzij anders vermeld).

- **Shell-scripts breken onder WSL-bash bij CRLF in de werkkopie** (2026-10-14):
  met `core.autocrlf=true` krijgt `scripts/fitness-check.sh` CRLF-regeleinden
  bij checkout (`git ls-files --eol` toont `i/lf w/crlf`); de WindowsApps
  `bash` (WSL) faalt dan met `$'\r': command not found` en een syntax-fout.
  Workaround: tijdelijke LF-geconverteerde kopie draaien. Structurele oplossing:
  `.gitattributes` met `*.sh text eol=lf` (nog niet aangebracht).
- **Pre-commit hook wijkt af van AGENTS.md** (2026-10-14): de hook
  (`.git/hooks/pre-commit`) behandelt `tsc --noEmit` en
  `eslint --max-warnings 0` als **niet-blokkerend** ("ok if project is
  scaffold-only"); alleen `fitness-check.sh` en Gitleaks blokkeren. AGENTS.md
  claimt dat tsc en ESLint de commit blokkeren. Gevolg: 6 pre-existing
  eslint-warnings staan op `main` (App.tsx 1x exhaustive-deps; toast.tsx en
  posthog.tsx 5x react-refresh/only-export-components) terwijl de
  documentatie anders suggereert. Fix zit in de hook of in AGENTS.md —
  nog niet doorgevoerd.