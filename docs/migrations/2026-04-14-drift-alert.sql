CREATE TABLE drift_alert (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_npi TEXT NOT NULL,
  drift_id TEXT NOT NULL UNIQUE,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX drift_alert_subject_created_idx
  ON drift_alert (subject_npi, created_at DESC);

CREATE INDEX drift_alert_subject_open_idx
  ON drift_alert (subject_npi, resolved_at);

CREATE INDEX drift_alert_severity_idx
  ON drift_alert (severity);
