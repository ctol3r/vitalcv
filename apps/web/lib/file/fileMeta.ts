/**
 * Wave D Phase 1 — Credentialing File metadata + TOC.
 *
 * Pure data + helpers. No fetch, no DB, no DOM. The file surface is a
 * compliance-style read-only render of a credentialing case packet.
 *
 * Truth contract:
 *   - The metadata returned here is demonstrative. It is keyed by
 *     `fileId` so the URL chooses the demo identity; it does NOT
 *     claim a real file identity. The page surface always renders a
 *     "demo file" banner so a viewer cannot mistake the render for a
 *     real credentialing file.
 *   - Section IDs match the design source (`view-file.jsx`).
 *   - No PSV decision-grade claim is made. Section §4 (Primary-
 *     Source Verifications) is a placeholder shell in Phase 1; later
 *     phases populate it from the real issuer-verification chain.
 */

export type FileSectionId =
  | 'cover'
  | 'applicant'
  | 'readiness'
  | 'psv'
  | 'attestation'
  | 'missing'
  | 'chain'
  | 'seal';

export interface FileTocEntry {
  id: FileSectionId;
  /** Section number, e.g. "§1". */
  n: string;
  label: string;
  pages: string;
}

export const FILE_TOC: ReadonlyArray<FileTocEntry> = [
  { id: 'cover', n: '§1', label: 'Cover Sheet', pages: '1' },
  { id: 'applicant', n: '§2', label: 'Applicant Identification', pages: '2–3' },
  { id: 'readiness', n: '§3', label: 'Readiness & Trust Summary', pages: '4–5' },
  { id: 'psv', n: '§4', label: 'Primary-Source Verifications', pages: '6–11' },
  { id: 'attestation', n: '§5', label: 'Attestation & Authorization', pages: '12–13' },
  { id: 'missing', n: '§6', label: 'Outstanding Items', pages: '14' },
  { id: 'chain', n: '§7', label: 'Chain of Custody · Audit Log', pages: '15–16' },
  { id: 'seal', n: '§8', label: 'Signatures & Seals', pages: '17' },
] as const;

/** Stable identifier for the section anchor element. */
export function sectionAnchorId(id: FileSectionId): string {
  return `sec-${id}`;
}

export interface FileMeta {
  /** The displayed file identifier, e.g. VCV-CF-2026-000841. */
  id: string;
  /** Numeric version that increments on file revisions. */
  version: number;
  /** ISO date the file was opened. */
  openedAt: string;
  /** ISO timestamp of the last revision. */
  lastRevisedAt: string;
  custodianOrg: string;
  recordType: string;
  reviewCycle: string;
  /** Legal classification — kept literal so banned-strings CI can scan. */
  classification: 'CONFIDENTIAL · PEER-REVIEW PRIVILEGED';
  /** Always true in Phase 1 — drives the demo banner. */
  isDemo: true;
}

/**
 * Build a FileMeta keyed by fileId. The fileId from the URL becomes
 * part of the rendered file identifier so different URLs produce
 * different stable demos. No DB read.
 */
export function buildFileMeta(fileId: string): FileMeta {
  // Sanitise to a printable subset to avoid HTML smuggling in case
  // the page ever rendered the id without escaping. Next/React
  // already escapes by default; this is belt-and-braces.
  const safe = fileId.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64) || 'demo';
  return {
    id: `VCV-CF-${safe.toUpperCase()}`,
    version: 1,
    openedAt: '2026-02-11',
    lastRevisedAt: '2026-04-23T09:14:00Z',
    custodianOrg: 'Demo CVO · Medical Staff Office',
    recordType: 'Demo · Initial Appointment · Allied Health Professional',
    reviewCycle: '24 months · NCQA CR §3 re-credentialing (demo)',
    classification: 'CONFIDENTIAL · PEER-REVIEW PRIVILEGED',
    isDemo: true,
  };
}
