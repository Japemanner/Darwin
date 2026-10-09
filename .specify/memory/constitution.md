<!--
## Sync Impact Report

- Version change: (unratified template) -> 1.0.0
- Version bump rationale: initial ratification — every placeholder filled with
  concrete values from user-supplied principles and repository context; no
  prior governed version exists, so semantic versioning starts at 1.0.0.
- Principles created (all new — no renames, no removals):
  - I. Dutch UI, English Code
  - II. Concept, Never Advice
  - III. Client Data Sensitivity (NON-NEGOTIABLE)
  - IV. Accessibility WCAG 2.1 AA
  - V. Typed External Clients, No Silent Failures
  - VI. Minimal Scope
  Note: template provided 5 principle slots; user specified 6 — a sixth
  section was added following the template's heading pattern.
- Added sections:
  - "Security & Data Protection Constraints" (concretizes Principle III)
  - "Development Workflow & Compliance Gates" (maps principles to review gates)
  - "Governance" (amendment procedure, versioning policy, compliance review)
- Removed sections: none.
- Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ aligned, no update required
    ("[Gates determined based on constitution file]" resolves dynamically to
    the principles below)
  - .specify/templates/spec-template.md — ✅ aligned, no update required
    (user stories / requirements / success criteria cover principle-driven
    constraints via FR-* entries at spec time)
  - .specify/templates/tasks-template.md — ✅ aligned, no update required
    (task categories are generated per feature; principles map to tasks via
    the plan's Constitution Check)
  - .opencode/commands/speckit.constitution.md — ✅ verified, no outdated
    references (`.specify/templates/commands/` does not exist in this repo;
    command paths are generic)
  - README.md / AGENTS.md — ✅ aligned, no update required (AGENTS.md rules
    are complementary and referenced, not contradicted)
- Follow-up TODOs: none — no placeholders intentionally deferred.
-->

# Darwin Constitution

## Core Principles

### I. Dutch UI, English Code
All user-facing UI copy MUST be written in Dutch with a formal-professional
tone ("u", zakelijke formuleringen). All code, identifiers, commit messages,
comments, and technical documentation MUST be in English.
Rationale: the product serves a Dutch professional audience while the
codebase remains maintainable for international tooling and contributors.

### II. Concept, Never Advice
The application MUST NEVER display a recommendation and MUST NEVER imply
advice. Every generated output MUST be visibly labeled "CONCEPT".
Rationale: outputs are machine-generated drafts for professional review;
advisory framing could create liability and false trust.

### III. Client Data Sensitivity (NON-NEGOTIABLE)
Client data is sensitive and MAY include health data. Therefore:
- Client content MUST NOT appear in logs, URLs, analytics, or browser storage
  beyond the active session.
- Uploaded files MUST be deleted after the run.
- No client content in third-party calls except the configured n8n webhook
  and Darwin API via the typed clients (Principle V).
Rationale: GDPR/AVG compliance for potentially category-1 (health) data;
persistence or leakage of client content is a data-protection incident.

### IV. Accessibility WCAG 2.1 AA
All UI MUST conform to WCAG 2.1 level AA. Features are only Done when
keyboard operability, contrast, focus states, and semantic markup meet AA.
Rationale: legal accessibility baseline and a professional-quality bar for
every user story.

### V. Typed External Clients, No Silent Failures
Every external call (n8n webhook, Darwin API) MUST go through a typed client
with explicit, user-visible error states. Silent failures (swallowed errors,
unhandled rejections, error states without UI feedback) are FORBIDDEN.
Rationale: untyped or silent integration failures break user trust and make
production debugging impossible.

### VI. Minimal Scope
The application MUST NOT include features beyond the specification. No
speculative configurability, no "flexibility" that was not requested, no
abstractions for single-use code.
Rationale: every unsolicited feature expands the privacy, accessibility, and
error-surface that this constitution has to defend.

## Security & Data Protection Constraints
- RLS MUST be enabled on every Supabase table; no exceptions (see AGENTS.md).
- No secrets in client code: only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` may enter the frontend bundle.
- Privileged operations MUST run in Supabase Edge Functions, never in the
  client (see AGENTS.md architecture rules 1-3).
- Storage buckets MUST have explicit policies; no public buckets without
  documented justification in FEATURES.md.
- Gitleaks secret scanning blocks every commit; exposed secrets are rotated
  immediately, never committed.

## Development Workflow & Compliance Gates
- Branching: feature-branch -> develop (test) -> main (production). Direct
  commits to main are FORBIDDEN (see AGENTS.md).
- Every plan MUST pass the Constitution Check (plan-template.md) against the
  principles above before implementation starts.
- Pre-commit gate: `tsc --noEmit`, fitness checks, Gitleaks, ESLint
  (max-warnings 0) — all must pass before a commit lands.
- After every feature: FEATURES.md update, regression suite, fitness check,
  and Supabase RLS/bucket verification (via Supabase MCP).
- Constitution Check gates at plan time:
  1. Dutch UI copy present in all user stories (Principle I)
  2. All outputs labeled "CONCEPT"; no advisory wording (Principle II)
  3. Data-flow audit: client content never persists beyond session
     (Principle III)
  4. Accessibility criteria defined per story (Principle IV)
  5. All external calls via typed clients with error states (Principle V)
  6. Scope traced to spec only; extras rejected (Principle VI)

## Governance
This constitution supersedes conflicting practices in specs, plans, and
tasks. Amendments require documentation (Sync Impact Report), a version bump
per semantic versioning (MAJOR for incompatible removals/redefinitions, MINOR
for added principles or expanded guidance, PATCH for clarifications), and a
conventional commit (`docs: amend constitution to vX.Y.Z (...)`).
Compliance is verified at three checkpoints: plan time (Constitution Check),
commit time (pre-commit hook), and feature completion (fitness check).
Violations MUST be fixed before proceeding; complexity beyond the
constitution MUST be justified in the plan's Complexity Tracking table.
Runtime development guidance lives in AGENTS.md; this file governs
principles only.

**Version**: 1.0.0 | **Ratified**: 2026-10-09 | **Last Amended**: 2026-10-09