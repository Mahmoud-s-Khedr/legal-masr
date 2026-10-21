-- Transactional outbox: deleted attachment files remain tracked until unlink succeeds.
-- Paths are native-only managed basenames, never renderer capabilities.
CREATE TABLE pending_file_deletions (
  relative_path TEXT PRIMARY KEY NOT NULL CHECK (length(relative_path) > 0)
) STRICT;
