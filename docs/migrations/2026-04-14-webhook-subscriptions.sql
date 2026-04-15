CREATE TABLE IF NOT EXISTS integration_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NULL,
  url TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_delivered_at TIMESTAMPTZ NULL,
  last_failure_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_webhook_subscriptions_org_active_idx
  ON integration_webhook_subscriptions (organization_id, active);

CREATE INDEX IF NOT EXISTS integration_webhook_subscriptions_active_idx
  ON integration_webhook_subscriptions (active);
