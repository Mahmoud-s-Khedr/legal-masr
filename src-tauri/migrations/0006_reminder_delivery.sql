CREATE TABLE reminder_deliveries (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('EVENT', 'TASK')),
  entity_id TEXT NOT NULL,
  reminder_date TEXT NOT NULL,
  delivered_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, reminder_date)
);

CREATE INDEX idx_reminder_deliveries_date
  ON reminder_deliveries(reminder_date DESC);
