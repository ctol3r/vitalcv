import {
  computeWatchtowerHash,
  type WatchtowerClaim,
  type WatchtowerClaimDelta,
  type WatchtowerDeltaKind,
  type WatchtowerSnapshot,
} from './eventStore';

export interface DeltaDetectionOptions {
  includeAddedClaimsOnInitialCheck?: boolean;
}

function normalizeStatus(status?: string | null): string | null {
  return typeof status === 'string' && status.trim().length > 0
    ? status.trim().toUpperCase()
    : null;
}

function isExpired(claim: WatchtowerClaim, checkedAt: string): boolean {
  if (normalizeStatus(claim.status) === 'EXPIRED') {
    return true;
  }

  if (!claim.expiresAt) {
    return false;
  }

  const expiresAtTime = Date.parse(claim.expiresAt);
  const checkedAtTime = Date.parse(checkedAt);

  if (!Number.isFinite(expiresAtTime) || !Number.isFinite(checkedAtTime)) {
    return false;
  }

  return expiresAtTime <= checkedAtTime;
}

function createDelta(
  snapshot: WatchtowerSnapshot,
  kind: WatchtowerDeltaKind,
  claim: WatchtowerClaim,
  details: Omit<WatchtowerClaimDelta, 'deltaId' | 'subjectId' | 'kind' | 'claimId' | 'claimType' | 'sourceId' | 'detectedAt'>,
): WatchtowerClaimDelta {
  const deltaSeed = {
    subscriptionId: snapshot.subscriptionId,
    subjectId: snapshot.subjectId,
    kind,
    claimId: claim.claimId,
    claimType: claim.claimType,
    detectedAt: snapshot.checkedAt,
    details,
  };

  return {
    deltaId: `delta_${computeWatchtowerHash(deltaSeed).slice(0, 24)}`,
    subjectId: snapshot.subjectId,
    kind,
    claimId: claim.claimId,
    claimType: claim.claimType,
    sourceId: claim.sourceId ?? null,
    detectedAt: snapshot.checkedAt,
    ...details,
  };
}

export function detectClaimChanges(
  previousSnapshot: WatchtowerSnapshot | null,
  currentSnapshot: WatchtowerSnapshot,
  options?: DeltaDetectionOptions,
): WatchtowerClaimDelta[] {
  if (!previousSnapshot) {
    if (!options?.includeAddedClaimsOnInitialCheck) {
      return [];
    }

    return currentSnapshot.claims.map((claim) => createDelta(currentSnapshot, 'CLAIM_ADDED', claim, {
      currentValue: claim.value,
      currentStatus: normalizeStatus(claim.status),
    }));
  }

  const remainingPreviousClaims = new Map<string, WatchtowerClaim>(
    previousSnapshot.claims.map((claim) => [claim.claimId, claim]),
  );
  const deltas: WatchtowerClaimDelta[] = [];

  for (const currentClaim of currentSnapshot.claims) {
    const previousClaim = remainingPreviousClaims.get(currentClaim.claimId);
    if (!previousClaim) {
      deltas.push(createDelta(currentSnapshot, 'CLAIM_ADDED', currentClaim, {
        currentValue: currentClaim.value,
        currentStatus: normalizeStatus(currentClaim.status),
      }));
      continue;
    }

    remainingPreviousClaims.delete(currentClaim.claimId);

    const previousStatus = normalizeStatus(previousClaim.status);
    const currentStatus = normalizeStatus(currentClaim.status);
    const valueChanged = computeWatchtowerHash(previousClaim.value) !== computeWatchtowerHash(currentClaim.value);
    const expiredTransition = !isExpired(previousClaim, previousSnapshot.checkedAt) && isExpired(currentClaim, currentSnapshot.checkedAt);

    if (valueChanged) {
      deltas.push(createDelta(currentSnapshot, 'CLAIM_CHANGED', currentClaim, {
        previousValue: previousClaim.value,
        currentValue: currentClaim.value,
        previousStatus,
        currentStatus,
      }));
    }

    if (expiredTransition) {
      deltas.push(createDelta(currentSnapshot, 'CLAIM_EXPIRED', currentClaim, {
        previousValue: previousClaim.value,
        currentValue: currentClaim.value,
        previousStatus,
        currentStatus,
      }));
      continue;
    }

    if (previousStatus !== currentStatus) {
      deltas.push(createDelta(currentSnapshot, 'CLAIM_STATUS_CHANGED', currentClaim, {
        previousValue: previousClaim.value,
        currentValue: currentClaim.value,
        previousStatus,
        currentStatus,
      }));
    }
  }

  for (const previousClaim of remainingPreviousClaims.values()) {
    deltas.push(createDelta(currentSnapshot, 'CLAIM_REMOVED', previousClaim, {
      previousValue: previousClaim.value,
      previousStatus: normalizeStatus(previousClaim.status),
    }));
  }

  return deltas.sort((left, right) => {
    const claimComparison = left.claimId.localeCompare(right.claimId);
    if (claimComparison !== 0) {
      return claimComparison;
    }

    return left.kind.localeCompare(right.kind);
  });
}
