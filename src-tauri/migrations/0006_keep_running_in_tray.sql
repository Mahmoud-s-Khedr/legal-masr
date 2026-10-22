ALTER TABLE app_settings ADD COLUMN keep_running_in_tray INTEGER NOT NULL DEFAULT 0 CHECK (keep_running_in_tray IN (0, 1));
