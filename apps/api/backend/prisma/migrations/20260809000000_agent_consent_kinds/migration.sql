-- A2.5 — consent kinds.
--
-- `point`   : approve once, runs now, with the clinician present. A proof may
--             only be minted inside a short freshness window; after that the
--             grant lapses FOR EXECUTION and the clinician is asked again.
--             Closes the A1 hole where an unexecuted grant stayed executable
--             forever.
-- `standing`: "keep doing this for me". Mandatory expires_at, capped at 90
--             days, revocable at any time, and available ONLY for
--             non-disclosing scopes.
--
-- Expiry is a READ-TIME PREDICATE, never a ledger write. Nothing sweeps this
-- table to mark grants expired: a background writer racing the head is
-- exactly the ambiguity the seq design exists to prevent.
--
-- Additive with a default matching the pre-A2.5 meaning — every grant written
-- before this migration was a point consent.

ALTER TABLE "agent_consent_events" ADD COLUMN IF NOT EXISTS "consent_kind" TEXT NOT NULL DEFAULT 'point';
ALTER TABLE "agent_consent_events" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
