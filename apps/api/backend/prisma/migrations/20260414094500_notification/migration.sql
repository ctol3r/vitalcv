-- Notification: lightweight operator-facing alert surface. Written by
-- drift reaction handlers. No FKs; independent of audit chains.

CREATE TABLE "notification" (
  "id"            UUID NOT NULL,
  "clinician_npi" TEXT NOT NULL,
  "event_type"    TEXT NOT NULL,
  "severity"      TEXT NOT NULL,
  "message"       TEXT NOT NULL,
  "acknowledged"  BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_clinician_npi_idx" ON "notification" ("clinician_npi");
CREATE INDEX "notification_acknowledged_idx"  ON "notification" ("acknowledged");
CREATE INDEX "notification_created_at_idx"    ON "notification" ("created_at");
