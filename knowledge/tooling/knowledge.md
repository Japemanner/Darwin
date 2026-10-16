# Tooling (Windows / WSL / Git / hooks) — kennis

Feiten en patronen (bevestigd door waarneming, tenzij anders vermeld).

- **Shell-scripts breken onder WSL-bash bij CRLF in de werkkopie** (2026-10-14):
  met `core.autocrlf=true` krijgt `scripts/fitness-check.sh` CRLF-regeleinden
  bij checkout (`git ls-files --eol` toont `i/lf w/crlf`); de WindowsApps
  `bash` (WSL) faalt dan met `'\r': command not found` en een syntax-fout.
  Workaround: tijdelijke LF-geconverteerde kopie draaien. Structurele oplossing:
  `.gitattributes` met `*.sh text eol=lf` — **aangebracht 2026-10-16**.
- **darwin.app wijst niet naar Netlify — parkeerstatus bij Atom.com**
  (2026-10-16 waargenomen): `https://darwin.app` serveert een Cloudflare
  challenge (`Cf-Mitigated: challenge`) met cookies voor `Domain=atom.com`;
  DNS (lokaal én 1.1.1.1) resolveert naar 52.20.84.62 (AWS), NS-records zijn
  `ns1/ns2.atom.com`. RDAP: registrar is Atom.com Domains LLC (eerst
  Porkbun, registratie 2023-09-28, expiratie 2027-09-28, dus NIET verlopen),
  maar "last changed 2026-10-15T23:22:38Z" — de NS-wijziging vond plaats
  in de nacht vóór de 010-release. Gevolg: de productie-frontend zoals
  geconfigureerd (quickstart 009/010, edge-function ALLOWED_ORIGINS,
  Netlify custom domain) is via dit domein onbereikbaar; headless
  smoke/canary-checks op dit domein falen sowieso op de CF-challenge.
  Vraag voor Jaap: domein bewust verkocht/verhuisd naar Atom.com, of
  onbedoelde transfer? Productie-bereikbaarheid hangt hiermee samen
  (T021-eindcontrole geblokkeerd tot dit is opgelost).
- **Pre-commit hook wijkt af van AGENTS.md** (2026-10-14): de hook
  (`.git/hooks/pre-commit`) behandelt `tsc --noEmit` en
  `eslint --max-warnings 0` als **niet-blokkerend** ("ok if project is
  scaffold-only"); alleen `fitness-check.sh` en Gitleaks blokkeren. AGENTS.md
  claimt dat tsc en ESLint de commit blokkeren. Gevolg: 6 pre-existing
  eslint-warnings staan op `main` (App.tsx 1x exhaustive-deps; toast.tsx en
  posthog.tsx 5x react-refresh/only-export-components) terwijl de
  documentatie anders suggereert. Fix zit in de hook of in AGENTS.md —
  nog niet doorgevoerd.