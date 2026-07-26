-- EmployerAcceptance.entity_id / organization were NOT NULL, but the row is
-- keyed on (employer_id, clinician_npi). Requiring entity_id/organization made
-- POST /api/employer-review/:entityId/accept and POST /api/hiring/accept throw
-- on every call (the writers omit them; Prisma rejects the missing required
-- scalar before SQL, rolling back the whole transaction).
--
-- DROP NOT NULL is a no-op on an already-nullable column, so this migration is
-- safe to replay — matching the idempotent house pattern from the drift
-- reconcile. Widening a constraint never invalidates existing rows.
ALTER TABLE "employer_acceptances" ALTER COLUMN "entity_id" DROP NOT NULL;
ALTER TABLE "employer_acceptances" ALTER COLUMN "organization" DROP NOT NULL;
