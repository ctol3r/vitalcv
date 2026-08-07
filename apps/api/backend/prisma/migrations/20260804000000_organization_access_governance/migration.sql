-- Organization access governance.
--
-- Two gaps this closes:
--
--   1. The refusal copy promised "a VitalCV reviewer will verify your
--      authority", but a refused request threw a 403 and vanished. No queue, no
--      history, and no route to access for a legitimate operator whose email
--      sits at a different domain. Every request is now durable.
--
--   2. NPI binding rode on the domain check. A work-email match proves control
--      of THAT domain — never that the domain owns a given Type 2 NPI — so an
--      automatic grant now records `npi_binding_granted = false` and leaves the
--      NPI unbound until a human decides.

CREATE TYPE "OrganizationAccessStatus" AS ENUM ('PENDING_REVIEW', 'GRANTED', 'DENIED');

CREATE TABLE "organization_access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_user_id" TEXT NOT NULL,
    "account_email" TEXT,
    "requested_name" TEXT NOT NULL,
    "requested_npi" TEXT,
    "requested_website" TEXT,
    "requested_domain" TEXT,
    "status" "OrganizationAccessStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "authority_reason" TEXT NOT NULL,
    "email_domain" TEXT,
    "organization_id" UUID,
    "npi_binding_granted" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "org_access_requests_status_idx" ON "organization_access_requests"("status", "created_at");
CREATE INDEX "org_access_requests_user_idx" ON "organization_access_requests"("clerk_user_id");
CREATE INDEX "org_access_requests_npi_idx" ON "organization_access_requests"("requested_npi");
CREATE INDEX "org_access_requests_org_idx" ON "organization_access_requests"("organization_id");
