-- Clinician activation: the durable profile draft (Wave 1076 B1).
--
-- Public-source and clinician-provided values are separate columns, not one
-- merged record. Once flattened, nothing downstream can distinguish a registry
-- answer from something the clinician typed, and the truth classes become
-- unrecoverable — which is the failure the activation decision forbids.
--
-- Bound to user_id, never to the NPI alone: an anonymous draft may live in the
-- browser before the claim step, but a durable private profile always has an
-- owner, or anyone submitting the same NPI would inherit another clinician's
-- corrections.

CREATE TABLE "clinician_profile_draft" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"              TEXT         NOT NULL,
    "npi"                  TEXT         NOT NULL,

    "resolved_snapshot"    JSONB        NOT NULL,
    "source_observations"  JSONB,
    "resolved_at"          TIMESTAMP(3),

    "clinician_fields"     JSONB        NOT NULL DEFAULT '{}',

    -- The three activation conditions, stamped independently.
    "reviewed_at"          TIMESTAMP(3),
    "sharing_confirmed_at" TIMESTAMP(3),
    "saved_at"             TIMESTAMP(3),

    -- Set once. Its presence is what stops a repeat save re-emitting
    -- clinician_profile_activated.
    "activated_at"         TIMESTAMP(3),

    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinician_profile_draft_pkey" PRIMARY KEY ("id")
);

-- One draft per user per NPI: makes save idempotent under retry.
CREATE UNIQUE INDEX "clinician_profile_draft_user_id_npi_key"
    ON "clinician_profile_draft"("user_id", "npi");

CREATE INDEX "clinician_profile_draft_user_id_idx"
    ON "clinician_profile_draft"("user_id");
