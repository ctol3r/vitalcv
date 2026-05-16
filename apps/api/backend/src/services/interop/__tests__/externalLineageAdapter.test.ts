/**
 * externalLineageAdapter — unit tests (W2-PR87A)
 *
 * Verifies the adapter contract:
 *   - non-NPI subject schemes (MRN, employee#) are NOT promoted to subjectNpi —
 *     adapter records subjectAdapted=false instead, preserving ambiguity at
 *     the schema boundary.
 *   - schema version drift between record and contract is fail-closed.
 *   - the adapted lineage's hints replay through traceCorruptionLineage in the
 *     same way locally-issued hints do (cross-system lineage continuity).
 *   - adapterDigest is deterministic and salts the systemId — two systems with
 *     the same record cannot produce identical digests.
 */

import {
  TrustInteropError,
  adaptExternalLineage,
  declareTrustContract,
  type AdaptedLineage,
  type TrustContract,
} from '../crossSystemTrustInterop';
import {
  traceCorruptionLineage,
} from '../../audit/replayCorruptionContainment';

function makeContract(systemId = 'epic-prod-12345', contractVersion = '1.0.0'): TrustContract {
  return declareTrustContract({
    contractId: `contract-${systemId}`,
    systemId,
    contractVersion,
    inboundFields: ['trustBand', 'sourceDigest', 'verdict', 'capturedAt'],
    outboundFields: ['trustBand', 'sourceDigest', 'verdict', 'capturedAt'],
  });
}

describe('adaptExternalLineage', () => {
  it('promotes a 10-digit NPI in scheme=npi to subjectNpi', () => {
    const adapted = adaptExternalLineage({
      contract: makeContract(),
      record: {
        externalCapsuleId: 'epic-cap-1',
        externalSubjectId: '1234567890',
        externalSubjectIdScheme: 'npi',
        externalCredentialIds: ['epic-cred-A'],
        externalSourceReferenceId: 'epic-ref-1',
        systemSchemaVersion: '1.0.0',
      },
    });
    expect(adapted.lineageHints.subjectNpi).toBe('1234567890');
    expect(adapted.subjectAdapted).toBe(true);
    expect(adapted.lineageHints.credentialIds).toEqual(['epic-cred-A']);
    expect(adapted.lineageHints.sourceReferenceId).toBe('epic-ref-1');
  });

  it('refuses to promote an MRN to subjectNpi (preserves ambiguity)', () => {
    const adapted = adaptExternalLineage({
      contract: makeContract(),
      record: {
        externalCapsuleId: 'epic-cap-2',
        externalSubjectId: 'MRN-987654321',
        externalSubjectIdScheme: 'mrn',
        externalCredentialIds: [],
        externalSourceReferenceId: null,
        systemSchemaVersion: '1.0.0',
      },
    });
    expect(adapted.lineageHints.subjectNpi).toBeNull();
    expect(adapted.subjectAdapted).toBe(false);
  });

  it('refuses to promote a non-NPI-shape value even when scheme is npi', () => {
    // E.g. a remote system declares scheme=npi but ships a 9-digit value.
    const adapted = adaptExternalLineage({
      contract: makeContract(),
      record: {
        externalCapsuleId: 'epic-cap-3',
        externalSubjectId: '123456789',
        externalSubjectIdScheme: 'npi',
        externalCredentialIds: [],
        externalSourceReferenceId: null,
        systemSchemaVersion: '1.0.0',
      },
    });
    expect(adapted.subjectAdapted).toBe(false);
  });

  it('throws CONTRACT_VERSION_DRIFT when systemSchemaVersion != contractVersion', () => {
    let caught: TrustInteropError | null = null;
    try {
      adaptExternalLineage({
        contract: makeContract('epic', '2.0.0'),
        record: {
          externalCapsuleId: 'epic-cap-4',
          externalSubjectId: '1234567890',
          externalSubjectIdScheme: 'npi',
          externalCredentialIds: [],
          externalSourceReferenceId: null,
          systemSchemaVersion: '1.0.0',
        },
      });
    } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('CONTRACT_VERSION_DRIFT');
  });

  it('throws LINEAGE_ADAPTER_MISMATCH on missing externalCapsuleId', () => {
    let caught: TrustInteropError | null = null;
    try {
      adaptExternalLineage({
        contract: makeContract(),
        record: {
          externalCapsuleId: '   ',
          externalSubjectId: '1234567890',
          externalSubjectIdScheme: 'npi',
          externalCredentialIds: [],
          externalSourceReferenceId: null,
          systemSchemaVersion: '1.0.0',
        },
      });
    } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('LINEAGE_ADAPTER_MISMATCH');
  });

  it('produces system-salted adapterDigests so two systems cannot collide', () => {
    const a = adaptExternalLineage({
      contract: makeContract('epic-prod'),
      record: {
        externalCapsuleId: 'cap-shared',
        externalSubjectId: '1234567890',
        externalSubjectIdScheme: 'npi',
        externalCredentialIds: ['cred-1'],
        externalSourceReferenceId: 'ref-1',
        systemSchemaVersion: '1.0.0',
      },
    });
    const b = adaptExternalLineage({
      contract: makeContract('cerner-prod'),
      record: {
        externalCapsuleId: 'cap-shared',
        externalSubjectId: '1234567890',
        externalSubjectIdScheme: 'npi',
        externalCredentialIds: ['cred-1'],
        externalSourceReferenceId: 'ref-1',
        systemSchemaVersion: '1.0.0',
      },
    });
    expect(a.adapterDigest).not.toBe(b.adapterDigest);
  });

  it('replays adapted lineage hints through traceCorruptionLineage', () => {
    const contract = makeContract();
    const adapted: AdaptedLineage = adaptExternalLineage({
      contract,
      record: {
        externalCapsuleId: 'epic-cap-root',
        externalSubjectId: '1234567890',
        externalSubjectIdScheme: 'npi',
        externalCredentialIds: ['cred-X'],
        externalSourceReferenceId: 'src-99',
        systemSchemaVersion: '1.0.0',
      },
    });
    const lineage = traceCorruptionLineage({
      rootCapsuleId: adapted.externalCapsuleId,
      rootHints: adapted.lineageHints,
      candidates: [
        { capsuleId: 'cand-a', hints: { subjectNpi: '1234567890', credentialIds: [], sourceReferenceId: null } },
        { capsuleId: 'cand-b', hints: { subjectNpi: null, credentialIds: ['cred-X'], sourceReferenceId: null } },
        { capsuleId: 'cand-c', hints: { subjectNpi: null, credentialIds: [], sourceReferenceId: 'src-99' } },
        { capsuleId: 'cand-d', hints: { subjectNpi: null, credentialIds: [], sourceReferenceId: null } },
      ],
    });
    expect(lineage.contaminatedCapsuleIds).toEqual(['cand-a', 'cand-b', 'cand-c']);
    expect(lineage.edges).toHaveLength(3);
  });
});
