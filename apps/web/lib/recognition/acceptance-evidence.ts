/**
 * Acceptance history → evidence objects for the Professional Memory timeline.
 *
 * Pure transform (no I/O): each recorded employer acceptance becomes an
 * `acceptance`-class EvidenceObject, the shape the Wave 225 projection stack
 * was designed for (see packages/domain-evidence timeline tests). Status is
 * 'checked' because an acceptance is a recorded employer decision backed by
 * a non-repudiable audit event — not an inference. The projector derives
 * recognitionImpact 'acceptance' from the class, which is what surfaces these
 * events in the timeline's recognition lane.
 */

import type { EvidenceObject, EvidenceRelationship } from '@vitalcv/domain-evidence';
import { isDecisionGradeStatus } from '@vitalcv/domain-evidence';
import {
  normalizeEmployerAcceptanceHistoryResponse,
  type EmployerAcceptanceHistoryEntry,
  type EmployerAcceptanceHistoryResponse,
} from '@/lib/employer-review-actions';

const ACCEPTANCE_STATUS = 'checked' as const;

function entryEvidenceId(entry: EmployerAcceptanceHistoryEntry, index: number): string {
  return `acceptance:${entry.acceptanceId ?? `${entry.acceptedAt}:${index}`}`;
}

export function acceptanceHistoryToEvidenceObjects(
  npi: string,
  history: EmployerAcceptanceHistoryResponse,
): { objects: EvidenceObject[]; relationships: EvidenceRelationship[] } {
  const objects: EvidenceObject[] = [];
  const relationships: EvidenceRelationship[] = [];

  history.history.forEach((entry, index) => {
    const evidenceId = entryEvidenceId(entry, index);

    objects.push({
      evidenceId,
      subjectKey: npi,
      evidenceClass: 'acceptance',
      label: `Accepted as head start — ${entry.orgLabel}`,
      value: {
        orgLabel: entry.orgLabel,
        acceptanceScope: entry.acceptanceScope,
        isAnonymized: entry.isAnonymized,
      },
      status: ACCEPTANCE_STATUS,
      source: {
        sourceId: 'EMPLOYER_REVIEW',
        sourceLabel: 'Employer review — recorded acceptance',
        laneType: null,
        governance: null,
      },
      trustTier: null,
      decisionGrade: isDecisionGradeStatus(ACCEPTANCE_STATUS),
      observedAt: entry.acceptedAt,
      checkedAt: entry.acceptedAt,
      expiresAt: null,
      freshnessWindowHours: null,
      integrityHash: null,
      provenance: {
        artifactIds: entry.acceptanceId ? [entry.acceptanceId] : [],
        receiptIds: [],
        sourceUrl: null,
        checksum: null,
        parserVersion: null,
      },
      lifecycle: 'active',
      supersedes: null,
      supersededBy: null,
    });

    if (entry.acceptedByOrgId) {
      relationships.push({
        from: evidenceId,
        to: entry.acceptedByOrgId,
        type: 'accepted_by',
        confidence: null,
        observedAt: entry.acceptedAt,
      });
    }
  });

  return { objects, relationships };
}

/**
 * Server-side read of the acceptance record for an NPI. Returns null on any
 * failure or when nothing is recorded — the timeline then simply projects
 * without acceptance events (honest omission, never fabricated entries).
 */
export async function fetchAcceptanceHistoryForTimeline(
  backendUrl: string,
  npi: string,
): Promise<EmployerAcceptanceHistoryResponse | null> {
  try {
    const res = await fetch(
      `${backendUrl}/api/employer-review/${encodeURIComponent(npi)}/acceptance-history`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;

    const parsed = normalizeEmployerAcceptanceHistoryResponse(await res.json());
    if (!parsed || !parsed.summary.hasPriorAcceptances) return null;
    return parsed;
  } catch {
    return null;
  }
}
