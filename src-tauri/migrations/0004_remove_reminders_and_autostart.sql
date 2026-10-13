-- Desktop notifications, reminder lead times and launch-at-login were removed
-- from the product. Their stored preferences and delivery log have no reader.
--
-- `DROP COLUMN` rewrites rows in place; it never drops and recreates a table,
-- so no `ON DELETE` action on hearings, tasks or attachments can fire here.
ALTER TABLE app_settings DROP COLUMN default_reminder_minutes;
ALTER TABLE app_settings DROP COLUMN autostart_enabled;
ALTER TABLE hearings DROP COLUMN reminder_minutes;
ALTER TABLE tasks DROP COLUMN reminder_minutes;

DROP INDEX idx_reminder_deliveries_date;
DROP TABLE reminder_deliveries;
