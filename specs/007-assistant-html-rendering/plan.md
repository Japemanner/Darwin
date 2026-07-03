# Implementation Plan: Assistant HTML Rendering

**Branch**: `007-assistant-html-rendering` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-assistant-html-rendering/spec.md`

## Summary

Assistenten leveren voortaan HTML in plaats van platte tekst. Het front-end moet die HTML veilig (XSS-sanitized) weergeven in de chat-bel en de geschiedenis-weergave, met behoud van exact de huidige visuele vormgeving. Technische aanpak: voeg `dompurify` toe als enige nieuwe dependency, extraheer één gedeelde `MessageContent`-component die de HTML sanitize en via `dangerouslySetInnerHTML` rendert, en vervang de twee huidige `{msg.content}`-renderlocaties door deze component. Oude platte-tekst berichten blijven ongewijzigd zichtbaar omdat DOMPurify platte tekst ongemoeid laat.

## Technical Context

**Language/Version**: TypeScript 5.6 + React 18 + Vite 6

**Primary Dependencies**: Nieuw: `dompurify` (+ `@types/dompurify`). Bestaand: `@supabase/supabase-js`, `react`, `tailwindcss` v3, `zustand`, `clsx`/`tailwind-merge` (via `cn`-helper).

**Storage**: Supabase PostgreSQL — `messages.content` (text-kolom) blijft ongewijzigd; wordt nu HTML-string i.p.v. platte tekst. Geen schema-wijziging, geen migratie, geen nieuwe kolommen.

**Testing**: Playwright MCP (conform AGENTS.md). Geen unit-testframework aanwezig — happy-path E2E + regressie via Playwright.

**Target Platform**: Browser (Netlify SPA). Server-side rendering is uitgesloten.

**Project Type**: Web-app (React SPA).

**Performance Goals**: Render van één bericht < 16ms (geen merkbare frame-drop). DOMPurify sanitize is ~1-3ms per typisch bericht.

**Constraints**: Visuele identiek aan huidige weergave (0 verschil in bubble-vormgeving, lettergrootte `text-sm`, kleuren, padding `px-4 py-2`, max-breedte `max-w-[80%]`). Geen nieuwe lay-out, geen typography-plugin (`@tailwindcss/typography` wijzigt stijlen — verboden).

**Scale/Scope**: 2 renderlocaties, 1 nieuwe component, 1 nieuwe utility-file, 1 nieuwe dependency. ~80 LOC nieuw, ~4 LOC gewijzigd.

## Constitution Check

Geen `.specify/constitution.md` aanwezig — geen gates van toepassing.

AGENTS.md-non-negotiables die relevant zijn:
- **RLS on every table**: Niet van toepassing — geen schema-wijziging (`messages` heeft al RLS).
- **No secrets in client code**: Niet van toepassing — geen nieuwe env-vars.
- **TypeScript strict mode**: Toegepast — `MessageContent` krijgt strikte typing, geen `any`.
- **PKCE auth flow**: Niet van toepassing.
- **Netlify SPA redirects**: Niet van toepassing — geen `netlify.toml`-wijziging.

## Project Structure

### Documentation (this feature)

```text
specs/007-assistant-html-rendering/
├── plan.md              # This file
├── spec.md              # Feature specification
└── checklists/
    └── requirements.md  # Spec quality checklist (PASS)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── sanitize.ts          # NEW — DOMPurify wrapper with allow-list config
├── components/
│   └── chat/
│       └── MessageContent.tsx  # NEW — shared HTML-rendering component
├── pages/
│   ├── AssistantsPage.tsx     # EDIT line 629 — {msg.content} → <MessageContent content={msg.content} />
│   └── HistoryPage.tsx        # EDIT line 251 — {msg.content} → <MessageContent content={msg.content} />
└── types/
    └── database.types.ts      # UNCHANGED — content blijft `string`

package.json                   # EDIT — add dompurify + @types/dompurify
```

**Structure Decision**: Web-app optie uit template. Eén gedeelde component in `src/components/chat/` voorkomt de huidige duplicatie tussen `AssistantsPage.tsx` en `HistoryPage.tsx`. Nieuwe utility in `src/lib/sanitize.ts` houdt DOMPurify-configuratie op één plek (single source of truth voor de allow-list).

## Complexity Tracking

Geen constitution-schendingen — tabel niet van toepassing.

## Research Notes

### Keuze: DOMPurify i.p.v. react-markdown

**Waarom DOMPurify**: De bron (n8n) levert HTML, geen markdown. Een markdown-parser (react-markdown + rehypeRaw + rehypeSanitize) voegt onnodige parsing toe. DOMPurify is smaller, sneller, minder deps — conform AGENTS.md "Geen onnodige dependencies".

**Waarom niet react-markdown**: Zou 4 packages toevoegen (`react-markdown`, `rehype-raw`, `rehype-sanitize`, `remark-gfm`) voor een probleem dat DOMPurify met 1 package oplost.

### DOMPurify allow-list config

Gebaseerd op Context7-docs (`/cure53/dompurify`, "Tight Allow-list Sanitization"):

```typescript
// src/lib/sanitize.ts
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'span', 'div',
  'h1', 'h2', 'h3', 'blockquote', 'code', 'pre',
]
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel']

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS, ALLOWED_ATTR })
}
```

**Allow-list-rationalisatie**: Alleen veilige tekst/structuur-tags. Expliciet uitgesloten: `script`, `iframe`, `img`, `style`, `form`, `input`, `object`, `embed` — allemaal XSS-vektoren of ongewenst in chat-bel. `img` bewust uitgesloten omdat afbeeldingen de lay-out zouden breken en "geen wijzigingen in wat de user ziet" verbieden.

### Backwards-compatibility met oude berichten

Oude `messages.content`-rijen bevatten platte tekst (geen HTML-tags). DOMPurify laat platte tekst ongemoeid — er zijn geen tags om te strippen. Resultaat: oude berichten renderen identiek. Geen migratie nodig, geen detectie-logica (geen "is dit HTML of platte tekst?"-check vereist).

### Visuele identiek — hoe gewaarborgd

1. **Container ongewijzigd**: De bestaande `<div className="rounded-lg px-4 py-2 text-sm bg-muted">` blijft exact zoals nu. `MessageContent` rendert *binnen* deze container.
2. **Geen Tailwind-typography-plugin**: `@tailwindcss/typography` voegt `prose`-stijlen toe die lettergrootte, regelafstand en marges wijzigen — dat is een zichtbare verandering. Expliciet niet toevoegen.
3. **HTML-elementen erven container-stijl**: `text-sm`, kleur en padding komen van de container. Binnenkomende `<p>` of `<strong>` krijgen geen eigen stijl — ze vallen door naar de Tailwind-reset (base layer) die ze display:block / inline maakt zonder extra marges.
4. **Edge case — marges op <p>**: Tailwind's Preflight reset verwijdert default browser-marges op `p`, `h1`, etc. Dus een HTML-antwoord met `<p>`-tags krijgt geen onverwachte verticale marges. Dit is hetzelfde gedrag als platte tekst vandaag (geen marges tussen regels).

### Render-pijplijn per bericht

```
msg.content (string, HTML of platte tekst)
    │
    ▼
sanitizeHtml(msg.content)  →  safe HTML string  (memoized per content)
    │
    ▼
<div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    │  (binnen de bestaande bg-muted rounded-lg px-4 py-2 text-sm container)
    ▼
Gebruiker ziet identieke weergave
```

### Bevestigde aanpassingslocaties (uit codebase-verkenning)

| Locatie | File | Regel | Huidige code | Nieuwe code |
|---------|------|------|--------------|-------------|
| Live chat | `src/pages/AssistantsPage.tsx` | 629 | `{msg.content}` | `<MessageContent content={msg.content} />` |
| Geschiedenis | `src/pages/HistoryPage.tsx` | 251 | `{msg.content}` | `<MessageContent content={msg.content} />` |

Beide locaties gebruiken identieke container-stijl — één component dekt beide.

### Wat NIET verandert (scope-begrenzing)

- `src/lib/webhook.ts` — ongewijzigd. `answer: string` blijft string, alleen de *inhoud* is HTML i.p.v. platte tekst. Geen interface-wijziging.
- `messages`-tabel / `database.types.ts` — ongewijzigd. `content: string` blijft string.
- `Bronnen`-block (sources) — ongewijzigd. Alleen `msg.content`-rendering verandert, niet `msg.sources`.
- n8n-workflow — buiten scope (assumptie in spec: n8n wordt apart aangepast om HTML te leveren).
- Streaming — uit scope (huidige architectie is request/response).
- Assistenten-management UI — ongewijzigd.

## Implementation Phases

### Fase 1 — Dependency & utility (fundament)
1. `npm install dompurify @types/dompurify`
2. Maak `src/lib/sanitize.ts` met `sanitizeHtml()` + allow-list config + link-hook
3. Verifieer `tsc --noEmit` groen

### Fase 2 — Gedeelde component
4. Maak `src/components/chat/MessageContent.tsx`
   - Ontvangt `content: string`
   - Memoized sanitize per content (`useMemo`)
   - Rendert `<div dangerouslySetInnerHTML={{ __html: safe }} />` (geen eigen className — erft container)
5. Verifieer `tsc --noEmit` groen

### Fase 3 — Integratie (beide renderlocaties)
6. `AssistantsPage.tsx:629` → `<MessageContent content={msg.content} />` + import
7. `HistoryPage.tsx:251` → `<MessageContent content={msg.content} />` + import
8. Verifieer `tsc --noEmit` + `npm run build` groen
9. Verifieer `npx eslint src/ --max-warnings 0` groen

### Fase 4 — Playwright-tests (via Playwright MCP, conform AGENTS.md)
10. Schrijf test: stel vraag aan assistent, verifieer antwoord verschijnt in chat-bel met `text-sm`/`bg-muted`-stijl
11. Schrijf test: open geschiedenis, verifieer oud bericht toont identiek
12. Schrijf test: lever antwoord met `<script>alert(1)</script>`, verifieer niet uitgevoerd
13. Run regressie-suite — alle tests groen

### Fase 5 — Quality gates (conform AGENTS.md "After Every Feature")
14. `tsc --noEmit` groen
15. `@feature-tracker` → update `FEATURES.md`
16. `@fitness-checker` → `scripts/fitness-check.sh` + Supabase MCP (F-01/F-10 niet van toepassing — geen schema-wijziging) + Snyk MCP (F-16 SAST op `src/`, F-17 SCA op `package.json` voor nieuwe `dompurify`-dep)
17. Commit met `feat(chat): render assistant answers as sanitized HTML` op feature-branch

## Risks & Mitigations

| Risico | Waarschijnlijkheid | Impact | Mitigatie |
|--------|-------------------|--------|-----------|
| DOMPurify default-config te ruim (laat `img`/`style` door) | Laag | Medium | Expliciete `ALLOWED_TAGS`-allow-list, niet de default |
| Oude berichten breken | Zeer laag | Hoog | DOMPurify laat platte tekst ongemoeid — geen migratie nodig |
| n8n levert markdown i.p.v. HTML | Medium | Medium | Spec-assumptie verduidelijkt dat n8n HTML levert; als het toch markdown is, tonen de markdown-tekens letterlijk (veilig, alleen niet-ideaal). Aparte follow-up-feature indien nodig. |
| `dangerouslySetInnerHTML` lints als unsafe | Medium | Laag | ESLint-config heeft geen `react/no-danger`-regel (gecheckt); `sanitize.ts` is het veiligheids-hekje, documenteer in component-JSDoc |
| Links openen inzelfde tab (navigation weg van app) | Medium | Medium | `afterSanitizeAttributes`-hook forceert `target=_blank rel=noopener noreferrer` op alle `<a>` |

## Open Items

Geen — alle keuzes zijn vastgesteld. Spec heeft 0 NEEDS CLARIFICATION markers.