# Specification Quality Checklist: Teambeheer: uitnodigen, rol wijzigen en blokkeren

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-31
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validation run 1: all items passed. Two consistency issues were corrected during the
  first pass: the status definition for an unblocked member with an existing password, and
  the wording around revoking an open invitation (an invitation can remain as a revoked
  record while its unused account is removed; only open invitations must have an account).
- No [NEEDS CLARIFICATION] markers were needed. Ambiguities with a reasonable default were
  resolved in Assumptions: revoking an unused invitation frees the e-mail address,
  resending replaces the link, blocking applies only to activated members, the
  last-active-admin rule counts only Actief members, and the platform-admin protection
  applies to office admins.
- The three prescribed Dutch messages are quoted verbatim. All other error states require a
  visible Dutch message that states what failed and what the user can do.
- Technology-agnostic wording is intentional: the spec says "server", "beheerrroute" and
  "eenmalige token" instead of naming the auth provider, database, or hosting platform.
