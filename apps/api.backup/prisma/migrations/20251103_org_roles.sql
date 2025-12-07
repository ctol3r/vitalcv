CREATE TABLE IF NOT EXISTS "Org"(id TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT DEFAULT 'us');
CREATE TABLE IF NOT EXISTS "OrgUser"(org_id TEXT, user_id TEXT, role TEXT, PRIMARY KEY(org_id,user_id));
CREATE INDEX IF NOT EXISTS idx_orguser_role ON "OrgUser"(role);

