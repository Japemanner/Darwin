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
- **Playwright-fixture-omgeving: import-volgorde is het contract** (2026-10-19,
  012): `tests/e2e/fixtures.ts` leest `E2E_EMAIL`/`E2E_PASSWORD` op
  moduleniveau. Een spec die `.env.local` pas in zijn eigen body laadt
  (`process.loadEnvFile`) draait ná de fixtures — die zien de variabelen dan
  niet en skippen alles. Oplossing (012, `answer-feedback.spec.ts`): een
  seed-helpermodule (`feedback-seed.ts`) die `.env.local` op moduleniveau
  laadt en als **eerste** import vóór `'./fixtures'` staat — static imports
  evalueren in bronvolgorde. Verificatie volgt bij de eerste live run
  (accounts nog niet gezet).
- **Parallelle git-acties kunnen de werkmap midden in een sessie beschadigen**
  (2026-10-19, 012-incident): een externe checkout naar een nieuwe branch
  (zelfde commit) liet plots zes bestanden als "both modified" met
  conflict-markers in de werkkopie achter, terwijl gestagede wijzigingen
  intact bleven; commits gingen gewoon door op de oorspronkelijke branch.
  Herstel zonder verlies: `git restore --staged --worktree -- <bestanden>`
  (content stond veilig in HEAD, beide branches identiek), daarna
  `git switch` terug. Les: vóór elke commit `git status` checken; bij
  onverklaarde unmerged-toestand eerst reflog + branch vergelijken, niet
  blind conflicten "oplossen".
- **Supabase MCP-deploy kapt grote Edge Function-bestanden af**
  (2026-10-20, 011-rollout waargenomen): `rag-chat` v2 (472 regels /
  19 KB, lokaal syntactisch gaaf) arriveerde server-side afgekapt op ~75%
  — de bundler meldde "Unexpected eof" bij het NOT_CONFIGURED-blok
  (regel ~355) en de publicatie ging niet door (productie bleef op v1,
  dus geen schade). Deploy is daarna via de dashboard-editor gelukt
  (volledig bestand copy-pasten, v2-markers visueel geverifieerd); ook
  012 is zo via de webUI uitgerold. Oorzaak van de truncatie onbekend
  (vermoeden: payload-limiet in het deploy-kanaal, afgekapt rond ~14,5 KB).
  Advies: functies groter dan ±15 KB deployen via Supabase CLI
  (`supabase functions deploy` — bundelt lokaal) of de webUI-editor; de
  MCP-route eerst op een kleine functie valideren.