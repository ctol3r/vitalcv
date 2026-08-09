# Workbench Note Data Policy — CC-05 / WB-02

**Scope:** the private note domain (`garden_notes`, `garden_cv_entries`,
`garden_note_revisions`, `garden_note_links`) behind the customer-facing
**VitalCV Workbench**. This is an implementation policy: it records what the
code enforces today. **It is not a compliance certification and makes no
regulated-data claim; enterprise retention and regulated-data posture require
counsel review before any enterprise rollout** (program decision, recorded in
the Workbench brief).

## Ownership and access

- Every row is scoped by the internal `User.id` resolved from the verified
  identity (`requireInternalUserId`). No endpoint accepts a caller-supplied
  user id. Cross-user access reads as **404, never 403** — existence and
  ownership are indistinguishable to a non-owner.
- Notes, revisions, and links are excluded from employer surfaces, matching,
  ranking, eligibility, dossier generation, and analytics by construction:
  nothing outside `services/garden/*` and the `/api/profile/garden/*` route
  family reads these tables (`gardenLinks.test.ts` and `gardenNotes.test.ts`
  pin the access contract).
- **Agent inputs (amended by WB-11, D1 decision 2026-08-09):** notes remain
  excluded from agent inputs **by default**. The clinician may opt an
  individual note into visibility for their own agent — explicit, per-note,
  revocable (`agentConsentAt`; NULL = excluded). The ONLY agent-facing
  accessor is `gardenAgentConsent.listAgentReadableNotes`, which re-checks
  consent at query time (revocation is effective on the next read — nothing
  is cached) and writes an `AuditEvent` before returning (ids and counts,
  never note text). **Opt-in is not disclosure**: it never widens employer
  surfaces, matching, ranking, eligibility, dossiers, or analytics, which
  continue to read nothing from these tables
  (`gardenAgentConsent.test.ts` pins the contract).
- Link targets are a closed allowlist (`note | cv_entry | opportunity |
  profile_field | source_pointer`), resolved inside the caller's legal
  visibility at create time and again at read time. A link is a research
  pointer, never evidence — it cannot set or elevate provenance.

## Retention and deletion

- Notes and CV lines persist until the clinician deletes them.
- Revisions are immutable pre-images retained for the life of their note.
- Deleting a note **hard-deletes** its revisions and its links in both
  directions in one transaction. Referenced targets are never touched.
- Deleting a grown CV line reopens its seed (existing behavior, unchanged).
- Account deletion inherits the platform's user-deletion path; Workbench
  rows carry no independent retention.
- **Export (WB-10, shipped):** `GET /api/profile/garden/export` returns the
  caller's entire Workbench — notes, revisions, links, CV lines — as one
  versioned document (`vitalcv-workbench-export/v1`). Every query is scoped
  by the resolved internal userId; the export is audited before the 2xx
  with counts only. This is the one sanctioned path out of the module
  besides promotion, and it exists solely at the clinician's request. The
  **account-closure walkthrough is UI and remains post-UX-03 scope**.

## Audit

Every mutation writes an `AuditEvent` before the 2xx:
`garden_note_created|updated|deleted|promoted`, `garden_cv_entry_removed`,
and (CC-05) `garden_note_revision_restored`, `garden_note_link_created`,
`garden_note_link_removed`. Audit rows carry ids and types, never note text.

## Patient information

Workbench notes are for professional-development content only. The capture
UI carries the standing reminder to keep patient-identifying and clinical
record data out. This reminder is a product instruction — it is a mitigation,
**not a substitute for compliance controls**, and no HIPAA claim is made or
implied (Experience Constitution EC-3 bans the phrase; the aligned wording is
"HIPAA-aligned" and only where genuinely applicable).

## What this policy deliberately does not cover yet

- Export format and portability (WB-10).
- Enterprise data residency, encryption-at-rest attestations, retention
  windows, and regulated-data posture (counsel review required first).
- Employer-side research workspaces (deferred; separate tenant model).
