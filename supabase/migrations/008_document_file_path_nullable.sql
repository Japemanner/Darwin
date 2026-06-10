-- Darwin Document Cleanup
-- Migration 008: Make file_path nullable (N8N sets it to NULL after processing)
--
-- After N8N processes a document and deletes the file from Storage,
-- it sets file_path = NULL. This indicates the file is no longer in Storage
-- but the vectors remain in the vector database.

ALTER TABLE knowledge_base_documents
  ALTER COLUMN file_path DROP NOT NULL;