CREATE MATERIALIZED VIEW IF NOT EXISTS usage_month_mv AS
SELECT org_id, date_trunc('month', window_start) AS month, sum(value) AS runs
FROM "UsageCounter" GROUP BY org_id, date_trunc('month', window_start);

CREATE INDEX IF NOT EXISTS idx_usage_month_mv ON usage_month_mv(org_id, month);

