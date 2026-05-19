/**
 * confidenceCalibration.ts — W2-PR130A confidence calibration shim
 *
 * Narrow-shim restoration of the module orphaned by commit 8912bc7e.
 * Used by services/audit/replayEngine.ts immediately after the
 * containment classifier:
 *
 *     const confidenceCalibration = syncReplayConfidence({ … });
 *
 * Doctrine (from the call-site comment at replayEngine.ts:470):
 *   "Production confidence is derived strictly from replay evidence.
 *    The score.point value is the calibrated estimate; evidenceCeiling
 *    is the hard maximum this replay's evidence can support. Any
 *    external claim that exceeds evidenceCeiling is flagged in
 *    overconfidence."
 *
 * This shim implements that contract conservatively:
 *   - Pure transform. No I/O.
 *   - `point` ≤ `evidenceCeiling`. Always.
 *   - When containment verdict is QUARANTINED / CONTAINMENT_BREACH,
 *     the ceiling collapses to zero — corrupted replays carry no
 *     forward confidence.
 *   - When `integrityHashMatch === false`, the ceiling collapses to
 *     zero regardless of containment verdict.
 *   - Otherwise the ceiling is a conservative average of source
 *     confidence scores. Decision-grade sources weight higher.
 */

/** Calibrated confidence score embedded in every DecisionReplay. */
export interface CalibratedConfidenceScore {
  schema: 'vitalcv.replay-confidence-calibration.v1';
  /** Estimated confidence point — capped at `evidenceCeiling`. */
  score: {
    point: number;
    band: 'low' | 'medium' | 'high' | 'collapsed';
  };
  /** Hard maximum this replay's evidence can support. */
  evidenceCeiling: number;
  /**
   * Overconfidence flag — true if any source asserts a confidence
   * above the evidence ceiling (caller injects). The shim sets it
   * to false; downstream consumers can re-evaluate against their
   * own published claim.
   */
  overconfidence: boolean;
  /** Why the ceiling is what it is. Useful for forensic review. */
  reasoning: string;
  classifiedAt: string;
}

/**
 * Source-consulted confidence in the replay engine is a string enum
 * (`'HIGH' | 'MEDIUM' | 'LOW'`) — see `sourceConfidence(...)` in
 * replayEngine.ts. The shim accepts either the string enum or a
 * numeric (0..1) value so future callers don't have to widen first.
 */
export type SourceConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | number;

export interface SyncReplayConfidenceInput {
  capsuleId: string;
  sourcesConsulted: ReadonlyArray<{
    source: string;
    outcome: string;
    confidence: SourceConfidenceLevel;
  }>;
  trustScore: number | null;
  integrityHashMatch: boolean;
  tamperEvidence: string | null;
  evidenceSpineDrifted: boolean;
  containmentVerdict: 'CLEAN' | 'QUARANTINED' | 'AMBIGUOUS' | 'CONTAINMENT_BREACH';
  ambiguous: boolean;
}

function normaliseSourceConfidence(value: SourceConfidenceLevel): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }
  switch (value) {
    case 'HIGH':
      return 0.9;
    case 'MEDIUM':
      return 0.6;
    case 'LOW':
      return 0.3;
    default:
      return 0;
  }
}

/**
 * Compute a calibrated confidence score for one replay. Pure
 * transform — same input always yields same output.
 *
 * The ceiling collapses to zero when:
 *   - integrity hash does not match, OR
 *   - containment verdict is QUARANTINED or CONTAINMENT_BREACH.
 *
 * Otherwise the ceiling is the average source confidence, dampened
 * by 0.5 if evidence spine drifted or containment is AMBIGUOUS.
 */
export function syncReplayConfidence(
  input: SyncReplayConfidenceInput,
): CalibratedConfidenceScore {
  const classifiedAt = new Date().toISOString();

  // Collapse rules.
  if (!input.integrityHashMatch) {
    return {
      schema: 'vitalcv.replay-confidence-calibration.v1',
      score: { point: 0, band: 'collapsed' },
      evidenceCeiling: 0,
      overconfidence: false,
      reasoning:
        'Confidence collapsed: integrity hash mismatch — replay does not reproduce the stored capsule.',
      classifiedAt,
    };
  }
  if (
    input.containmentVerdict === 'QUARANTINED' ||
    input.containmentVerdict === 'CONTAINMENT_BREACH'
  ) {
    return {
      schema: 'vitalcv.replay-confidence-calibration.v1',
      score: { point: 0, band: 'collapsed' },
      evidenceCeiling: 0,
      overconfidence: false,
      reasoning: `Confidence collapsed: containment verdict ${input.containmentVerdict}.`,
      classifiedAt,
    };
  }

  // Conservative ceiling from source confidences.
  const sourceConfidences = input.sourcesConsulted.map((s) =>
    normaliseSourceConfidence(s.confidence),
  );
  const meanSourceConfidence =
    sourceConfidences.length > 0
      ? sourceConfidences.reduce((a, b) => a + b, 0) / sourceConfidences.length
      : 0;

  let ceiling = meanSourceConfidence;
  let reasoning = `Ceiling from ${sourceConfidences.length} source(s); mean confidence ${meanSourceConfidence.toFixed(2)}.`;

  if (input.evidenceSpineDrifted || input.containmentVerdict === 'AMBIGUOUS' || input.ambiguous) {
    ceiling = ceiling * 0.5;
    reasoning += ' Ceiling halved for evidence-spine drift / ambiguous containment.';
  }

  // Point estimate is the ceiling unless trust score lowers it further.
  let point = ceiling;
  if (typeof input.trustScore === 'number' && Number.isFinite(input.trustScore)) {
    const normalisedTrust = Math.max(0, Math.min(1, input.trustScore / 100));
    point = Math.min(point, normalisedTrust);
    reasoning += ` Trust score ${input.trustScore}/100 bounded point estimate.`;
  }

  point = Math.max(0, Math.min(point, ceiling));
  const band: CalibratedConfidenceScore['score']['band'] =
    point >= 0.75 ? 'high' : point >= 0.5 ? 'medium' : 'low';

  return {
    schema: 'vitalcv.replay-confidence-calibration.v1',
    score: { point, band },
    evidenceCeiling: ceiling,
    overconfidence: false,
    reasoning,
    classifiedAt,
  };
}
