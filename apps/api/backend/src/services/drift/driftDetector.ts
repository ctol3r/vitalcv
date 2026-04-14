/**
 * driftDetector.ts — append-only drift detection at ingest time.
 *
 * Caller provides the new sourceCheck value for a (npi, source) pair.
 * Detector reads the most recent prior value (from VerificationArtifact
 * if no callback override is provided), compares with deterministic
 * canonicalization, and persists a DriftEvent row when the values
 * differ. Returns the created event (or null when there's no drift).
 *
 * MUST NOT mutate any historical row — old artifacts and old
 * attestations stay valid forever, so historical decisions remain
 * replayable against the data that informed them.
 *
 * Best-effort: write failures do not throw back to the caller.
 */

import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { canonicalizeJson } from '../attestation/canonicalize';
import { log } from '../../obs/logger';

export type DriftType =
  | 'first_observation'
  | 'value_changed'
  | 'status_flipped'
  | 'verification_lost';

export interface DriftDetectionInput {
  subjectNpi: string;
  source: string;
  /** The full normalized payload of the new source check. */
  newValue: unknown;
  /**
   * Optional override — caller may supply the prior value directly when
   * it has it cached (avoids the prisma round-trip). When omitted, the
   * detector reads the most recent VerificationArtifact for (npi, source).
   */
  previousValue?: unknown;
  /**
   * Optional explicit driftType. When omitted the detector classifies
   * as 'first_observation' (no prior) or 'value_changed' (any diff).
   */
  driftType?: DriftType;
}

export interface DriftDetectionResult {
  drifted: boolean;
  driftType: DriftType | null;
  eventId: string | null;
}

const NO_DRIFT: DriftDetectionResult = {
  drifted: false,
  driftType: null,
  eventId: null,
};

async function loadPreviousValue(
  npi: string,
  source: string,
): Promise<unknown> {
  try {
    const prev = await prisma.verificationArtifact.findFirst({
      where: { npi, source },
      orderBy: { verifiedAt: 'desc' },
      select: { rawPayload: true },
    });
    return prev?.rawPayload ?? null;
  } catch (error) {
    log('warn', 'drift_previous_load_failed', {
      npi_prefix: npi.slice(0, 4) + '····',
      source,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

export async function detectAndRecordDrift(
  input: DriftDetectionInput,
): Promise<DriftDetectionResult> {
  if (!input.subjectNpi || !input.source) {
    return NO_DRIFT;
  }

  const previousValue =
    input.previousValue !== undefined
      ? input.previousValue
      : await loadPreviousValue(input.subjectNpi, input.source);

  const newCanonical = canonicalizeJson(input.newValue);
  const prevCanonical = previousValue == null ? null : canonicalizeJson(previousValue);

  // No prior observation — record a 'first_observation' event so the
  // ingest history is complete from the very first check.
  if (prevCanonical === null) {
    return persistDriftEvent({
      subjectNpi: input.subjectNpi,
      source: input.source,
      previousValue: null,
      newValue: input.newValue,
      driftType: input.driftType ?? 'first_observation',
    });
  }

  // No drift — values canonicalize identically.
  if (prevCanonical === newCanonical) {
    return NO_DRIFT;
  }

  return persistDriftEvent({
    subjectNpi: input.subjectNpi,
    source: input.source,
    previousValue,
    newValue: input.newValue,
    driftType: input.driftType ?? 'value_changed',
  });
}

async function persistDriftEvent(input: {
  subjectNpi: string;
  source: string;
  previousValue: unknown;
  newValue: unknown;
  driftType: DriftType;
}): Promise<DriftDetectionResult> {
  try {
    const row = await prisma.driftEvent.create({
      data: {
        subjectNpi: input.subjectNpi,
        source: input.source,
        previousValue:
          input.previousValue == null
            ? Prisma.JsonNull
            : (JSON.parse(canonicalizeJson(input.previousValue)) as Prisma.InputJsonValue),
        newValue: JSON.parse(canonicalizeJson(input.newValue)) as Prisma.InputJsonValue,
        driftType: input.driftType,
      },
      select: { id: true },
    });
    log('info', 'drift_event_recorded', {
      npi_prefix: input.subjectNpi.slice(0, 4) + '····',
      source: input.source,
      driftType: input.driftType,
    });
    return { drifted: true, driftType: input.driftType, eventId: row.id };
  } catch (error) {
    log('warn', 'drift_event_write_failed', {
      npi_prefix: input.subjectNpi.slice(0, 4) + '····',
      source: input.source,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NO_DRIFT;
  }
}
