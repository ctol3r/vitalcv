-- Wave M — persisted reusable readiness snapshot ("verify once, reuse
-- everywhere"). One immutable row per share-time issuance: readiness +
-- canonical source-coverage report exactly as issued, pinned by contentHash.
-- Freshness is recomputed at read time as an overlay and never written back.
-- Revocation fails closed via the snapshot's own revokedAt or the linked
-- bundle's revoked share. Zero PHI: readiness states, source ids, and
-- timestamps only. `id` is generated client-side by Prisma (@default(uuid()))
-- — no DB-level default, matching the fleet's Postgres (no gen_random_uuid).

CREATE TABLE "ReadinessSnapshot" (
    "id" UUID NOT NULL,
    "npi" TEXT NOT NULL,
    "entityId" UUID,
    "bundleId" UUID,
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "scope" JSONB,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByClerkUserId" TEXT,

    CONSTRAINT "ReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReadinessSnapshot_npi_issuedAt_idx" ON "ReadinessSnapshot"("npi", "issuedAt");

CREATE INDEX "ReadinessSnapshot_bundleId_idx" ON "ReadinessSnapshot"("bundleId");

CREATE INDEX "ReadinessSnapshot_contentHash_idx" ON "ReadinessSnapshot"("contentHash");
