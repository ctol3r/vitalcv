import { describe, expect, it } from 'vitest';

import type { PassportData } from '../lib/trust/passport-contract';
import { passportToStreamSeed } from '../lib/hybrid-loader/passportToStreamSeed';

/**
 * `passportToStreamSeed` is a pure mapping function: `PassportData → IngestStreamState`.
 * It reads a focused subset of passport fields (identity, standing, readiness) and
 * never calls the full passport type guard. That means fixtures only need to carry
 * the fields the mapper actually reads — the `as PassportData` cast is safe because
 * no other fields are consulted.
 *
 * Builder structure mirrors the fields the mapper reads:
 *   - identity.{displayName,status,specialty,entityType,npi?}
 *   - entityId, npi?
 *   - standing.{exclusionStatus,exclusionClear,pecosEnrollmentStatus}
 *   - readiness.{status,score,level}
 */
interface MinimalPassport {
  entityId: string;
  npi?: string;
  identity: {
    displayName: string;
    specialty?: string;
    entityType: string;
    status: string;
    npi?: string;
  };
  standing: {
    exclusionClear: boolean;
    exclusionStatus: PassportData['standing']['exclusionStatus'];
    pecosEnrollmentStatus: PassportData['standing']['pecosEnrollmentStatus'];
  };
  readiness: {
    status: PassportData['readiness']['status'];
    score: number;
    level: string;
  };
}

function buildPassport(overrides: Partial<MinimalPassport> = {}): PassportData {
  const base: MinimalPassport = {
    entityId: 'entity-42',
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosEnrollmentStatus: 'ENROLLED',
    },
    readiness: {
      status: 'READY',
      score: 92,
      level: 'L2',
    },
  };

  const merged: MinimalPassport = {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...(overrides.identity ?? {}) },
    standing: { ...base.standing, ...(overrides.standing ?? {}) },
    readiness: { ...base.readiness, ...(overrides.readiness ?? {}) },
  };

  // Cast — the mapper only reads the fields above. Other required fields on
  // PassportData (authority, training, sourceCoverage, trustPosture, …) are
  // never accessed by `passportToStreamSeed`.
  return merged as unknown as PassportData;
}

describe('passportToStreamSeed', () => {
  it('maps a fully authoritative passport to a done, usable stream state', () => {
    const seed = passportToStreamSeed(buildPassport());

    expect(seed.phase).toBe('done');
    expect(seed.isUsable).toBe(true);
    expect(seed.npi).toBe('1234567890');
    expect(seed.anchorEntityId).toBe('entity-42');
    expect(seed.readyAt).toBeDefined();

    expect(seed.identity.entityId).toBe('entity-42');
    expect(seed.identity.displayName).toBe('Ada Lovelace');
    expect(seed.identity.specialty).toBe('Cardiology');
    expect(seed.identity.entityType).toBe('PERSON');
    expect(seed.identity.status).toBe('ACTIVE');
    expect(seed.identity.authoritative).toBe(true);
  });

  it('forwards standing from the passport (exclusion + enrollment)', () => {
    const seed = passportToStreamSeed(buildPassport());

    expect(seed.standing.exclusionChecked).toBe(true);
    expect(seed.standing.exclusionClear).toBe(true);
    expect(seed.standing.exclusionStatus).toBe('CLEAR');
    expect(seed.standing.enrollmentChecked).toBe(true);
    expect(seed.standing.enrollmentStatus).toBe('ENROLLED');
  });

  it('forwards readiness score, level, and status', () => {
    const seed = passportToStreamSeed(buildPassport());

    expect(seed.readiness.score).toBe(92);
    expect(seed.readiness.level).toBe('L2');
    expect(seed.readiness.status).toBe('READY');
  });

  it('marks identity non-authoritative when status is UNKNOWN', () => {
    const seed = passportToStreamSeed(
      buildPassport({ identity: { displayName: 'Ada Lovelace', entityType: 'PERSON', status: 'UNKNOWN' } }),
    );

    expect(seed.identity.authoritative).toBe(false);
    expect(seed.isUsable).toBe(false);
    expect(seed.anchorEntityId).toBeUndefined();
    expect(seed.readyAt).toBeUndefined();
  });

  it('marks identity non-authoritative when status is MISSING or PREVIEW', () => {
    const missing = passportToStreamSeed(
      buildPassport({ identity: { displayName: 'Ada Lovelace', entityType: 'PERSON', status: 'MISSING' } }),
    );
    const preview = passportToStreamSeed(
      buildPassport({ identity: { displayName: 'Ada Lovelace', entityType: 'PERSON', status: 'PREVIEW' } }),
    );

    expect(missing.identity.authoritative).toBe(false);
    expect(missing.isUsable).toBe(false);
    expect(preview.identity.authoritative).toBe(false);
    expect(preview.isUsable).toBe(false);
  });

  it('marks identity non-authoritative when displayName is empty', () => {
    const seed = passportToStreamSeed(
      buildPassport({ identity: { displayName: '', entityType: 'PERSON', status: 'ACTIVE' } }),
    );

    expect(seed.identity.authoritative).toBe(false);
    expect(seed.isUsable).toBe(false);
    expect(seed.sources.nppes).toBe('pending');
  });

  it('maps standing.exclusionStatus UNCHECKED to sources.oig = pending', () => {
    const seed = passportToStreamSeed(
      buildPassport({
        standing: {
          exclusionClear: false,
          exclusionStatus: 'UNCHECKED',
          pecosEnrollmentStatus: 'ENROLLED',
        },
      }),
    );

    expect(seed.standing.exclusionChecked).toBe(false);
    expect(seed.sources.oig).toBe('pending');
    // Identity is still authoritative, so the seed remains usable.
    expect(seed.isUsable).toBe(true);
  });

  it('maps pecosEnrollmentStatus UNCHECKED / UNKNOWN to enrollmentChecked: false and sources.pecos = pending', () => {
    const unchecked = passportToStreamSeed(
      buildPassport({
        standing: {
          exclusionClear: true,
          exclusionStatus: 'CLEAR',
          pecosEnrollmentStatus: 'UNCHECKED',
        },
      }),
    );
    const unknown = passportToStreamSeed(
      buildPassport({
        standing: {
          exclusionClear: true,
          exclusionStatus: 'CLEAR',
          pecosEnrollmentStatus: 'UNKNOWN',
        },
      }),
    );

    expect(unchecked.standing.enrollmentChecked).toBe(false);
    expect(unchecked.standing.enrollmentStatus).toBeUndefined();
    expect(unchecked.sources.pecos).toBe('pending');

    expect(unknown.standing.enrollmentChecked).toBe(false);
    expect(unknown.standing.enrollmentStatus).toBeUndefined();
    expect(unknown.sources.pecos).toBe('pending');
  });

  it('falls back to identity.npi when the top-level npi is absent', () => {
    const seed = passportToStreamSeed(
      buildPassport({
        npi: undefined,
        identity: {
          displayName: 'Ada Lovelace',
          entityType: 'PERSON',
          status: 'ACTIVE',
          npi: '9876543210',
        },
      }),
    );

    expect(seed.npi).toBe('9876543210');
    // Identity is still authoritative even when only identity.npi is set.
    expect(seed.isUsable).toBe(true);
    expect(seed.anchorEntityId).toBe('entity-42');
  });

  it('returns seed.npi undefined when neither npi is provided — still usable via entityId', () => {
    const seed = passportToStreamSeed(
      buildPassport({
        npi: undefined,
        // Explicitly clear identity.npi too — the builder's base identity
        // carries an NPI, so the override must blank both.
        identity: {
          displayName: 'Ada Lovelace',
          entityType: 'PERSON',
          status: 'ACTIVE',
          npi: undefined,
        },
      }),
    );

    expect(seed.npi).toBeUndefined();
    expect(seed.isUsable).toBe(true);
    expect(seed.anchorEntityId).toBe('entity-42');
  });

  it('is pure — same input produces the same mapped fields (readyAt aside)', () => {
    const passport = buildPassport();
    const a = passportToStreamSeed(passport);
    const b = passportToStreamSeed(passport);

    // Every mapped field except readyAt (which is Date.now()-based) must be
    // identical across invocations. Compare by JSON to avoid strict identity
    // failures on nested object references.
    const strip = (seed: ReturnType<typeof passportToStreamSeed>) => {
      const { readyAt: _readyAt, ...rest } = seed;
      return JSON.stringify(rest);
    };

    expect(strip(a)).toBe(strip(b));
  });
});
