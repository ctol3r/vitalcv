/**
 * EvidenceCapsule — re-exported, NOT reimplemented.
 *
 * The directive lists `EvidenceCapsule` among the components to build. It
 * already exists, at `apps/web/components/home/evidence/EvidenceCapsule.tsx`,
 * and it ships on `/` today via `LiveNpiResult`.
 *
 * CD-2.5 ("One system") and CD-16 are explicit that the answer to "we need this
 * component" is to extend what exists or replace it outright — never to add a
 * second implementation. CD-16 names additive design debt as "the single
 * largest visual liability this codebase carries", and the audit behind that
 * clause counted 41 badge/chip components across 35 files expressing overlapping
 * axes. Writing a second capsule to satisfy a checklist is precisely how that
 * happens.
 *
 * So this file is a re-export: it gives the design system one canonical import
 * path for the capsule, and the homepage keeps the single owning implementation.
 * The `home/` module remains the owner — per the Home Evidence v2 contract,
 * which assigns live-result rendering to `LiveNpiResult.tsx` and forbids a
 * second implementation of any row in its ownership table.
 *
 * If the capsule needs to change, change it there.
 */
export {
  EvidenceCapsuleResolved,
  EvidenceCapsuleResolving,
  EvidenceCapsuleError,
} from '@/components/home/evidence/EvidenceCapsule';

export type {
  EvidenceCapsuleModel,
  EvidenceRow,
  EvidenceRowKind,
} from '@/components/home/evidence/evidenceCapsuleModel';
