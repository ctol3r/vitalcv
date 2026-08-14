-- Bind future StartAttestations to one application and organization. Existing
-- attestations are preserved. Where historical duplicate attestations exist,
-- only the newest receives the application binding; older rows remain explicit
-- legacy records instead of being deleted or rewritten.

ALTER TABLE "start_attestations"
  ADD COLUMN "application_id" UUID,
  ADD COLUMN "organization_id" UUID,
  ADD COLUMN "confirmed_by" TEXT;

WITH ranked AS (
  SELECT
    sa."id",
    ea."application_id",
    o."organization_id",
    ROW_NUMBER() OVER (
      PARTITION BY ea."application_id"
      ORDER BY sa."started_at" DESC, sa."created_at" DESC, sa."id" DESC
    ) AS row_number
  FROM "start_attestations" sa
  JOIN "employer_acceptances" ea ON ea."id"::text = sa."acceptance_id"
  JOIN "applications" a ON a."id" = ea."application_id"
  JOIN "Opportunity" o ON o."id" = a."opportunity_id"
  WHERE ea."application_id" IS NOT NULL
)
UPDATE "start_attestations" sa
SET
  "application_id" = ranked."application_id",
  "organization_id" = ranked."organization_id"
FROM ranked
WHERE sa."id" = ranked."id" AND ranked.row_number = 1;

CREATE UNIQUE INDEX "start_attestations_application_id_key"
  ON "start_attestations"("application_id");
CREATE INDEX "start_attestations_organization_id_idx"
  ON "start_attestations"("organization_id");
