CREATE TABLE IF NOT EXISTS "PSVAlertSetting"(
  tenant_id TEXT PRIMARY KEY,
  daily_threshold INT DEFAULT 70,
  weekly_threshold INT DEFAULT 80,
  email TEXT
);

