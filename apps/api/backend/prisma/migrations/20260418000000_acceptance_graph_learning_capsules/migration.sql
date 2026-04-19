-- Acceptance Graph & Decision Learning — captures passport state at
-- decision time so the Predictive Acceptance engine can learn from
-- real employer outcomes.
--
-- Distinct from "decision_capsules" (which is an immutable
-- cryptographic audit capsule) — this table is a mutable-shape
-- learning record whose schema is expected to evolve.

CREATE TABLE "decision_learning_capsules" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "clinicianId"       UUID         NOT NULL,
    "employerId"        UUID         NOT NULL,
    "role"              TEXT         NOT NULL,
    "passportSnapshot"  JSONB        NOT NULL,
    "decisionOutcome"   TEXT         NOT NULL,
    "timeToDecision"    INTEGER      NOT NULL,
    "timestamp"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_learning_capsules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_learning_capsules_clinicianId_idx"                      ON "decision_learning_capsules"("clinicianId");
CREATE INDEX "decision_learning_capsules_employerId_idx"                       ON "decision_learning_capsules"("employerId");
CREATE INDEX "decision_learning_capsules_role_idx"                             ON "decision_learning_capsules"("role");
CREATE INDEX "decision_learning_capsules_decisionOutcome_idx"                  ON "decision_learning_capsules"("decisionOutcome");
CREATE INDEX "decision_learning_capsules_employerId_decisionOutcome_idx"       ON "decision_learning_capsules"("employerId", "decisionOutcome");
CREATE INDEX "decision_learning_capsules_timestamp_idx"                        ON "decision_learning_capsules"("timestamp");
