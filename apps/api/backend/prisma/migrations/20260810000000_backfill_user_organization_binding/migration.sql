-- Wave 1 Binding B — backfill the employer tenancy binding.
--
-- `User.organizationId` is the membership store the employer surfaces read to
-- resolve the caller's organization (`getOrgForVerifier`,
-- `resolveVerifiedOrganizationId`). Self-serve organization setup created the
-- Organization, the OrganizationProfile, and an ADMIN WorkspaceMembership, but
-- never wrote this column — so every employer who signed up through the product
-- resolved to no organization and got a 404 "Application not found." on their
-- own applications. The write path is fixed in `upsertOrgProfile`; this repairs
-- the rows that were already created without it.
--
-- This migration changes NO schema. It is data-only, and `schema.prisma` is
-- untouched by it.
--
-- Safety properties:
--   * Fills only NULL. An existing binding is never overwritten or moved.
--   * Reads only the user's OWN active memberships, so it can never bind a user
--     to an organization they are not already an active member of.
--   * Fills only when those memberships resolve to EXACTLY ONE organization.
--     `User.organizationId` holds a single org; a user with active memberships
--     in several is genuinely ambiguous, and guessing which one governs them
--     would fabricate a tenancy binding. Those rows are deliberately left NULL
--     for a human to resolve rather than silently given an organization.
--   * Idempotent and safe to re-run: rows it filled are no longer NULL, so a
--     second run matches nothing.

UPDATE "User" AS u
SET "organizationId" = resolved.organization_id
FROM (
  SELECT
    pp."user_id" AS user_id,
    MIN(op."organization_id"::text)::uuid AS organization_id
  FROM "person_profiles" pp
  JOIN "workspace_memberships" wm
    ON wm."person_profile_id" = pp."id"
   AND wm."active" = true
  JOIN "organization_profiles" op
    ON op."id" = wm."organization_profile_id"
  GROUP BY pp."user_id"
  HAVING COUNT(DISTINCT op."organization_id") = 1
) AS resolved
WHERE u."id" = resolved.user_id
  AND u."organizationId" IS NULL;
