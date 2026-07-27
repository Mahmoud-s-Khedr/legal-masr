CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lawyer_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  full_name TEXT NOT NULL,
  bar_number TEXT,
  phone TEXT,
  email TEXT,
  office_address TEXT,
  logo_relative_path TEXT,
  default_currency TEXT NOT NULL DEFAULT 'EGP',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  language TEXT NOT NULL DEFAULT 'ar',
  theme TEXT NOT NULL DEFAULT 'system',
  date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
  week_starts_on INTEGER NOT NULL DEFAULT 0,
  default_reminder_minutes INTEGER NOT NULL DEFAULT 60,
  lock_timeout_minutes INTEGER NOT NULL DEFAULT 15,
  managed_documents_directory TEXT,
  backup_directory TEXT,
  backup_enabled INTEGER NOT NULL DEFAULT 1,
  backup_frequency TEXT NOT NULL DEFAULT 'manual',
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
