import type { TrustStateApiDependencies } from '../../trust-state';
import type { PsvReceiptSnapshot } from '../../../../packages/domain-core';
import {
  EmployerAcceptance,
  RecognitionEvent,
  type SignatureProof,
} from '../../../../packages/domain-events';
import { CrsEngine } from '../../../../packages/crs';
import { AuditLedger, buildAuditScrapbook } from '../../../../packages/audit';
import { PsvStore } from '../../../../packages/psv';
import { TrustStateResolver } from '../../../../packages/trust-state';

function toDomainSnapshots(psvStore: PsvStore, receiptIds: readonly string[]): PsvReceiptSnapshot[] {
  return psvStore.listByIds(receiptIds).map((receipt) => ({
    receiptId: receipt.receipt_id,
    fetchedAt: receipt.fetched_at,
    ttlSeconds: receipt.ttl_seconds,
    revoked: receipt.revoked,
  }));
}

function proofFor(verificationMethod: string): SignatureProof {
  return {
    type: 'Ed25519Signature2020',
    verificationMethod,
    proofValue: `proof:${verificationMethod}`,
  };
}

describe('reuseAcrossEmployers.e2e', () => {
  it('proves verify once, reuse everywhere with identical CRS and no new PSV', async () => {
    const clinician_id = 'did:key:clinician-reuse-001';

    const psvStore = new PsvStore();
    const audit = new AuditLedger();
    const acceptances: EmployerAcceptance[] = [];

    let nowIso = '2026-02-07T09:00:00.000Z';

    const verifyPrimarySource = jest.fn(() =>
      JSON.stringify({
        source: 'ABMS',
        checked_at: '2026-02-07T09:00:00.100Z',
      }),
    );

    const receipt = psvStore.append({
      clinician_id,
      receipt: {
        source_authority: 'ABMS',
        access_or_license_id: 'LIC-REUSE-001',
        transaction_id: 'txn-reuse-001',
        fetched_at: '2026-02-07T09:00:00.000Z',
        raw_response: verifyPrimarySource(),
        ttl_seconds: 86400,
      },
    });

    audit.append({
      clinician_id,
      event_type: 'PSV_RECEIPT',
      reference_id: receipt.receipt_id,
      occurred_at: '2026-02-07T09:00:00.200Z',
      metadata: { source_authority: receipt.source_authority },
    });

    const recognition = new RecognitionEvent({
      subjectId: clinician_id,
      employerId: 'did:key:recognition-network',
      recognizedAt: '2026-02-07T09:00:01.000Z',
      psvReceipts: toDomainSnapshots(psvStore, [receipt.receipt_id]),
      proof: proofFor('did:key:recognition-network#key-1'),
    });

    audit.append({
      clinician_id,
      event_type: 'RECOGNITION',
      reference_id: recognition.recognitionId,
      occurred_at: '2026-02-07T09:00:01.100Z',
      metadata: {
        receipt_count: recognition.psvReceiptIds.length,
        hashAnchor: recognition.hashAnchor,
        proofType: recognition.proof.type,
        verificationMethod: recognition.proof.verificationMethod,
      },
    });

    const crs = new CrsEngine({
      receipts: {
        listByClinician: (subjectId) => psvStore.listByClinician(subjectId),
      },
      acceptances: {
        existsForClinician: (subjectId) =>
          acceptances.some((acceptance) => acceptance.subjectId === subjectId),
      },
      missing_acceptance_band: 'YELLOW',
    });

    const trustStateDeps: TrustStateApiDependencies = {
      crs,
      receipts: {
        listByClinician: (subjectId) => Array.from(psvStore.listByClinician(subjectId)),
      },
      acceptances: {
        existsForClinician: (subjectId) =>
          acceptances.some((acceptance) => acceptance.subjectId === subjectId),
        listByClinician: (subjectId) =>
          acceptances
            .filter((acceptance) => acceptance.subjectId === subjectId)
            .map((acceptance) => ({
              clinician_id: acceptance.subjectId,
              employer_id: acceptance.employerId,
              facility_id: acceptance.facilityId,
              role: acceptance.role,
              accepted_at: acceptance.acceptedAt,
              acceptance_id: acceptance.acceptanceId,
              hash_anchor: acceptance.hashAnchor,
              employer_proof: acceptance.employerProof,
            })),
      },
      starts: {
        existsForClinician: () => false,
        existsForScope: () => false,
      },
      audit: {
        append: (event) => {
          const reference_id =
            event.event_type === 'TRUST_STATE_DECAY'
              ? event.metadata.receipt_id
              : `trust-${event.clinician_id}-${event.occurred_at}`;

          audit.append({
            clinician_id: event.clinician_id,
            event_type: event.event_type,
            reference_id,
            occurred_at: event.occurred_at,
            metadata: event.metadata,
          });

          const packet = buildAuditScrapbook(event.clinician_id, audit.listByClinician(event.clinician_id));
          return { audit_packet_id: packet.audit_packet_id };
        },
      },
      now: () => new Date(nowIso),
    };
    const trustStateResolver = new TrustStateResolver(trustStateDeps);

    const psvCountBefore = psvStore.listReceiptIdsByClinician(clinician_id).length;

    const acceptanceA = new EmployerAcceptance({
      recognition,
      employerId: 'did:key:employer-A',
      facilityId: 'facility:A',
      role: 'role:rn',
      acceptedAt: '2026-02-07T09:00:02.000Z',
      countersignedAt: '2026-02-07T09:00:03.000Z',
      countersignedByEmployer: true,
      employerProof: proofFor('did:key:employer-A#key-1'),
    });
    acceptances.push(acceptanceA);

    audit.append({
      clinician_id,
      event_type: 'EMPLOYER_ACCEPTANCE',
      reference_id: acceptanceA.acceptanceId,
      occurred_at: '2026-02-07T09:00:03.100Z',
      metadata: {
        employer_id: acceptanceA.employerId,
        facility_id: acceptanceA.facilityId,
        role: acceptanceA.role,
        accepted_at: acceptanceA.acceptedAt,
        hashAnchor: acceptanceA.hashAnchor,
        proofType: acceptanceA.employerProof.type,
        verificationMethod: acceptanceA.employerProof.verificationMethod,
      },
    });

    nowIso = '2026-02-07T09:00:04.000Z';
    const trustA = await trustStateResolver.resolve(clinician_id, {
      employer_id: acceptanceA.employerId,
      facility_id: acceptanceA.facilityId,
      role: acceptanceA.role,
    });

    expect(trustA.start_ready).toBe(true);
    expect(trustA.band).toBe('GREEN');

    const psvCountAfterA = psvStore.listReceiptIdsByClinician(clinician_id).length;
    const crsA = await crs.computeForClinician({ clinician_id, as_of: nowIso });

    const acceptanceB = new EmployerAcceptance({
      recognition,
      employerId: 'did:key:employer-B',
      facilityId: 'facility:B',
      role: 'role:rn',
      acceptedAt: '2026-02-07T09:00:05.000Z',
      countersignedAt: '2026-02-07T09:00:06.000Z',
      countersignedByEmployer: true,
      employerProof: proofFor('did:key:employer-B#key-1'),
    });
    acceptances.push(acceptanceB);

    audit.append({
      clinician_id,
      event_type: 'EMPLOYER_ACCEPTANCE',
      reference_id: acceptanceB.acceptanceId,
      occurred_at: '2026-02-07T09:00:06.100Z',
      metadata: {
        employer_id: acceptanceB.employerId,
        facility_id: acceptanceB.facilityId,
        role: acceptanceB.role,
        accepted_at: acceptanceB.acceptedAt,
        hashAnchor: acceptanceB.hashAnchor,
        proofType: acceptanceB.employerProof.type,
        verificationMethod: acceptanceB.employerProof.verificationMethod,
      },
    });

    nowIso = '2026-02-07T09:00:07.000Z';
    const trustB = await trustStateResolver.resolve(clinician_id, {
      employer_id: acceptanceB.employerId,
      facility_id: acceptanceB.facilityId,
      role: acceptanceB.role,
    });

    expect(trustB.start_ready).toBe(true);
    expect(trustB.band).toBe('GREEN');

    const psvCountAfterB = psvStore.listReceiptIdsByClinician(clinician_id).length;
    const crsB = await crs.computeForClinician({ clinician_id, as_of: nowIso });

    expect(verifyPrimarySource).toHaveBeenCalledTimes(1);
    expect(psvCountBefore).toBe(1);
    expect(psvCountAfterA).toBe(psvCountBefore);
    expect(psvCountAfterB).toBe(psvCountBefore);

    expect(crsA.score).toBe(crsB.score);
    expect(crsA.band).toBe(crsB.band);
    expect(crsA.blocking_reasons).toEqual(crsB.blocking_reasons);

    const auditPacket = buildAuditScrapbook(clinician_id, audit.listByClinician(clinician_id));

    const psvEvents = auditPacket.timeline.filter((event) => event.event_type === 'PSV_RECEIPT');
    expect(psvEvents).toHaveLength(1);

    const acceptanceEvents = auditPacket.timeline.filter(
      (event) => event.event_type === 'EMPLOYER_ACCEPTANCE',
    );
    expect(acceptanceEvents).toHaveLength(2);

    const acceptedEmployers = acceptanceEvents.map((event) => String(event.metadata.employer_id)).sort();
    expect(acceptedEmployers).toEqual(['did:key:employer-A', 'did:key:employer-B']);

    const replayPrefix = auditPacket.timeline
      .filter((event) =>
        ['PSV_RECEIPT', 'RECOGNITION', 'EMPLOYER_ACCEPTANCE'].includes(event.event_type),
      )
      .map((event) => event.event_type);
    expect(replayPrefix).toEqual([
      'PSV_RECEIPT',
      'RECOGNITION',
      'EMPLOYER_ACCEPTANCE',
      'EMPLOYER_ACCEPTANCE',
    ]);
  });
});
