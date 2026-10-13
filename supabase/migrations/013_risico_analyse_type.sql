-- Risico-analyse assistant type
-- Migration 013: extend ai_assistants.type CHECK constraint with 'risico_analyse'
--
-- Root cause of PostgREST 23514 (check_violation) on POST /rest/v1/ai_assistants:
-- the frontend type union was extended with 'risico_analyse' (feature 008),
-- but the database CHECK constraint only allowed ('chat', 'agent', 'voice').

ALTER TABLE ai_assistants
  DROP CONSTRAINT ai_assistants_type_check;

ALTER TABLE ai_assistants
  ADD CONSTRAINT ai_assistants_type_check
  CHECK (type IN ('chat', 'agent', 'voice', 'risico_analyse'));