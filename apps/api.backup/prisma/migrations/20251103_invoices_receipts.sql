CREATE TABLE IF NOT EXISTS "Invoice"(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id TEXT NOT NULL, month TEXT NOT NULL, subtotal NUMERIC, tax NUMERIC, total NUMERIC, currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_org_month ON "Invoice"(org_id, month);
CREATE TABLE IF NOT EXISTS "Receipt"(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id UUID REFERENCES "Invoice"(id), issued_at TIMESTAMPTZ DEFAULT now(), payload JSONB);

