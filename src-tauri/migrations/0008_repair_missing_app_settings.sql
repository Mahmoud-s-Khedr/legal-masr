-- Some pre-release vaults reached the canonical schema without the singleton
-- settings record.  Settings are required for every unlocked vault; use the
-- canonical defaults without changing an existing user's preferences.
INSERT OR IGNORE INTO app_settings (id, created_at, updated_at)
VALUES (
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
