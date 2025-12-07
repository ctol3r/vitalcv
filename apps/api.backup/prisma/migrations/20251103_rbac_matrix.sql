CREATE TABLE IF NOT EXISTS "Permission"(key TEXT PRIMARY KEY, description TEXT);
CREATE TABLE IF NOT EXISTS "RolePerm"(role TEXT, perm_key TEXT REFERENCES "Permission"(key), PRIMARY KEY(role,perm_key));

