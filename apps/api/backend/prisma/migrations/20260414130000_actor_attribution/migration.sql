-- Actor + tenant attribution — additive, all optional. Existing callers
-- of prisma.auditEvent.create / prisma.decisionAttestation.create stay
-- backward-compatible.

ALTER TABLE "decision_attestation"
  ADD COLUMN "actor_id"        TEXT,
  ADD COLUMN "organization_id" TEXT;
CREATE INDEX "decision_attestation_actor_id_idx"        ON "decision_attestation" ("actor_id");
CREATE INDEX "decision_attestation_organization_id_idx" ON "decision_attestation" ("organization_id");

ALTER TABLE "AuditEvent" ADD COLUMN "actorId" TEXT;
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent" ("actorId");
