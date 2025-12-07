CREATE TABLE IF NOT EXISTS "ConsentLog"(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, action TEXT, ts TIMESTAMPTZ DEFAULT now(), meta JSONB );

