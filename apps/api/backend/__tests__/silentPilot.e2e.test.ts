import { resolveTrustState, type TrustStateApiDependencies } from '../../trust-state';
import { CanonicalPathService } from '../../domain';
import type { PsvReceiptSnapshot } from '../../../../packages/domain-core';
import { CrsEngine } from '../../../../packages/crs';
import { AuditLedger, buildAuditScrapbook } from '../../../../packages/audit';
import { PsvStore } from '../../../../packages/psv';

function asDomainReceiptSnapshots(psvStore: PsvStore, receiptIds: readonly string[]): PsvReceiptSnapshot[] {
  return psvStore.listByIds(receiptIds).map((value) => ({
    receiptId: value.receipt_id,
    fetchedAt: value.fetched_at,
    ttlSeconds: value.ttl_seconds,
    revoked: value.revoked,
  }));
}

function createTrustStateAuditAppender(audit: AuditLedger) {
  return (event: {
    event_type: 'TRUST_STATE_CHECK' | 'TRUST_STATE_DECAY';
    clinician_id: string;
    occurred_at: string;
    metadata: Record<string, unknown>;
  }) => {
    const reference_id =
      event.event_type === 'TRUST_STATE_DECAY'
        ? String(event.metadata.receipt_id || `decay-${event.clinician_id}-${event.occurred_at}`)
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
  };
}

function proofFor(verificationMethod: string) {
  return {
    type: 'Ed25519Signature2020',
    verificationMethod,
    proofValue: `proof:${verificationMethod}`,
  };
}

describe('silentPilot.e2e', () => {
  it('enforces Recognition -> Acceptance -> Start with trust-state as the only decision surface', async () => {
    const clinician_id = 'did:key:clinician-silent-001';
    const employer_id = 'did:key:employer-silent-001';

    const path = new CanonicalPathService();
    const psvStore = new PsvStore();
    const audit = new AuditLedger();

    const acceptanceRecords: Array<{
      clinician_id: string;
      employer_id: string;
      facility_id: string;
      role: string;
      accepted_at: string;
      acceptance_id: string;
      hash_anchor: string;
      employer_proof: {
        type: string;
        verificationMethod: string;
        proofValue: string;
      };
    }> = [];
    const startedClinicians = new Set<string>();

    const crs = new CrsEngine({
      receipts: {
        listByClinician: (subjectId) => psvStore.listByClinician(subjectId),
      },
      acceptances: {
        existsForClinician: (subjectId) =>
          acceptanceRecords.some((record) => record.clinician_id === subjectId),
      },
      missing_acceptance_band: 'YELLOW',
    });

    let nowIso = '2026-02-06T10:00:00.000Z';

    const trustStateDeps: TrustStateApiDependencies = {
      crs,
      receipts: {
        listByClinician: (subjectId) => Array.from(psvStore.listByClinician(subjectId)),
      },
      acceptances: {
        existsForClinician: (subjectId) =>
          acceptanceRecords.some((record) => record.clinician_id === subjectId),
        listByClinician: (subjectId) =>
          acceptanceRecords.filter((record) => record.clinician_id === subjectId),
      },
      starts: {
        existsForClinician: (subjectId) => startedClinicians.has(subjectId),
      },
      audit: {
        append: createTrustStateAuditAppender(audit),
      },
      now: () => new Date(nowIso),
    };

    const getTrustState = async (subjectId: string) => resolveTrustState(subjectId, trustStateDeps);

    // Step 1: create clinician subject id (identity only, no documents)
    expect(clinician_id).toContain('did:key:');

    // Fail-closed checks for missing prerequisites.
    expect(() =>
      path.createAcceptance({
        recognitionId: 'missing-recognition',
        facilityId: 'facility:alpha',
        acceptedAt: '2026-02-06T10:15:00.000Z',
        countersignedAt: '2026-02-06T10:16:00.000Z',
        countersignedByEmployer: true,
        employerProof: proofFor('did:key:missing-recognition#key-1'),
      }),
    ).toThrow();

    expect(() =>
      path.createStart({
        acceptanceId: 'missing-acceptance',
        attestedAt: '2026-02-06T10:20:00.000Z',
        crsScore: 95,
        proof: proofFor('did:key:missing-acceptance#key-1'),
      }),
    ).toThrow();

    // Step 2: attach >=1 valid PSV receipt through a single explicit verification call.
    const verifyPrimarySource = jest.fn(() =>
      JSON.stringify({
        source: 'ABMS',
        payload: 'ABMS_RAW_CONTENT_MUST_NOT_BE_PERSISTED',
        checkedAt: '2026-02-06T10:01:00.000Z',
      }),
    );

    const receipt = psvStore.append({
      clinician_id,
      receipt: {
        source_authority: 'ABMS',
        access_or_license_id: 'LIC-001',
        transaction_id: 'txn-001',
        fetched_at: '2026-02-06T10:01:00.000Z',
        raw_response: verifyPrimarySource(),
        ttl_seconds: 86400,
      },
    });

    audit.append({
      clinician_id,
      event_type: 'PSV_RECEIPT',
      reference_id: receipt.receipt_id,
      occurred_at: '2026-02-06T10:01:01.000Z',
      metadata: { source_authority: receipt.source_authority },
    });

    expect(JSON.stringify(receipt.toJSON())).not.toContain('ABMS_RAW_CONTENT_MUST_NOT_BE_PERSISTED');

    // Step 3: issue RecognitionEvent with required receipt linkage.
    const receiptSnapshots: PsvReceiptSnapshot[] = asDomainReceiptSnapshots(psvStore, [receipt.receipt_id]);

    const recognition = path.createRecognition({
      subjectId: clinician_id,
      employerId: employer_id,
      recognizedAt: '2026-02-06T10:05:00.000Z',
      psvReceipts: receiptSnapshots,
      proof: proofFor('did:key:recognition-network#key-1'),
    });

    audit.append({
      clinician_id,
      event_type: 'RECOGNITION',
      reference_id: recognition.recognitionId,
      occurred_at: '2026-02-06T10:05:01.000Z',
      metadata: {
        receipt_count: recognition.psvReceiptIds.length,
        hashAnchor: recognition.hashAnchor,
        proofType: recognition.proof.type,
        verificationMethod: recognition.proof.verificationMethod,
      },
    });

    // Step 4: compute CRS; score must be >= 80.
    const crsBeforeAcceptance = await crs.computeForClinician({
      clinician_id,
      as_of: '2026-02-06T10:06:00.000Z',
    });
    expect(crsBeforeAcceptance.score).toBeGreaterThanOrEqual(80);

    // Step 5: employer calls /trust-state.
    nowIso = '2026-02-06T10:07:00.000Z';
    const beforeAcceptanceTrust = await getTrustState(clinician_id);
    expect(beforeAcceptanceTrust.start_ready).toBe(false);
    expect(beforeAcceptanceTrust.blocking_reasons).toContain('MISSING_ACCEPTANCE');

    // Step 6: employer records Acceptance.
    const acceptance = path.createAcceptance({
      recognitionId: recognition.recognitionId,
      facilityId: 'facility:alpha',
      acceptedAt: '2026-02-06T10:10:00.000Z',
      countersignedAt: '2026-02-06T10:11:00.000Z',
      countersignedByEmployer: true,
      employerProof: proofFor('did:key:employer-silent-001#key-1'),
    });
    acceptanceRecords.push({
      clinician_id,
      employer_id: acceptance.employerId,
      facility_id: acceptance.facilityId,
      role: acceptance.role,
      accepted_at: acceptance.acceptedAt,
      acceptance_id: acceptance.acceptanceId,
      hash_anchor: acceptance.hashAnchor,
      employer_proof: acceptance.employerProof,
    });

    audit.append({
      clinician_id,
      event_type: 'ACCEPTANCE',
      reference_id: acceptance.acceptanceId,
      occurred_at: '2026-02-06T10:11:01.000Z',
      metadata: {
        recognition_id: acceptance.recognitionId,
        hashAnchor: acceptance.hashAnchor,
        proofType: acceptance.employerProof.type,
        verificationMethod: acceptance.employerProof.verificationMethod,
      },
    });

    nowIso = '2026-02-06T10:12:00.000Z';
    const readyTrust = await getTrustState(clinician_id);
    expect(readyTrust.start_ready).toBe(true);
    expect(readyTrust.score).toBeGreaterThanOrEqual(80);
    expect(readyTrust.band).toBe('GREEN');

    // Step 7: employer attests Start.
    const crsAtStart = await crs.computeForClinician({
      clinician_id,
      as_of: '2026-02-06T10:20:00.000Z',
    });
    expect(crsAtStart.score).toBeGreaterThanOrEqual(80);

    const start = path.createStart({
      acceptanceId: acceptance.acceptanceId,
      attestedAt: '2026-02-06T10:20:00.000Z',
      crsScore: crsAtStart.score,
      proof: proofFor('did:key:employer-silent-001#key-2'),
    });
    startedClinicians.add(clinician_id);

    audit.append({
      clinician_id,
      event_type: 'START',
      reference_id: start.startId,
      occurred_at: '2026-02-06T10:20:01.000Z',
      metadata: {
        acceptance_id: start.acceptanceId,
        hashAnchor: start.hashAnchor,
        proofType: start.proof.type,
        verificationMethod: start.proof.verificationMethod,
      },
    });

    console.log('Recognition → Acceptance → Start');

    // After start attestation, trust-state must fail closed as idempotent (already started).
    nowIso = '2026-02-06T10:21:00.000Z';
    const afterStartTrust = await getTrustState(clinician_id);
    expect(afterStartTrust.start_ready).toBe(false);
    expect(afterStartTrust.blocking_reasons).toContain('START_ALREADY_ATTESTED');

    // No credential documents exchanged through trust-state.
    const trustPayload = JSON.stringify(readyTrust);
    expect(trustPayload).not.toContain('ABMS_RAW_CONTENT_MUST_NOT_BE_PERSISTED');
    expect(readyTrust).not.toHaveProperty('raw_response');
    expect(readyTrust).not.toHaveProperty('documents');

    // No re-verification: verification adapter called exactly once.
    expect(verifyPrimarySource).toHaveBeenCalledTimes(1);

    // Audit scrapbook replay is deterministic and complete.
    const firstPacket = buildAuditScrapbook(clinician_id, audit.listByClinician(clinician_id));
    const secondPacket = buildAuditScrapbook(clinician_id, audit.listByClinician(clinician_id));

    expect(firstPacket).toEqual(secondPacket);

    const timelineTypes = firstPacket.timeline.map((event) => event.event_type);
    expect(timelineTypes).toContain('PSV_RECEIPT');
    expect(timelineTypes).toContain('RECOGNITION');
    expect(timelineTypes).toContain('ACCEPTANCE');
    expect(timelineTypes).toContain('START');
    expect(timelineTypes).toContain('TRUST_STATE_CHECK');

    const canonicalTimeline = timelineTypes.filter((eventType) =>
      ['RECOGNITION', 'ACCEPTANCE', 'START'].includes(eventType),
    );
    expect(canonicalTimeline).toEqual(['RECOGNITION', 'ACCEPTANCE', 'START']);
  });

  it('blocks a previously accepted clinician after PSV decay and records TRUST_STATE_DECAY', async () => {
    const clinician_id = 'did:key:clinician-silent-decay-001';
    const employer_id = 'did:key:employer-silent-decay-001';

    const path = new CanonicalPathService();
    const psvStore = new PsvStore();
    const audit = new AuditLedger();

    const acceptanceRecords: Array<{
      clinician_id: string;
      employer_id: string;
      facility_id: string;
      role: string;
      accepted_at: string;
      acceptance_id: string;
      hash_anchor: string;
      employer_proof: {
        type: string;
        verificationMethod: string;
        proofValue: string;
      };
    }> = [];
    const startedClinicians = new Set<string>();

    const crs = new CrsEngine({
      receipts: {
        listByClinician: (subjectId) => psvStore.listByClinician(subjectId),
      },
      acceptances: {
        existsForClinician: (subjectId) =>
          acceptanceRecords.some((record) => record.clinician_id === subjectId),
      },
      missing_acceptance_band: 'YELLOW',
    });

    let nowIso = '2026-02-06T12:00:00.000Z';
    const trustStateDeps: TrustStateApiDependencies = {
      crs,
      receipts: {
        listByClinician: (subjectId) => Array.from(psvStore.listByClinician(subjectId)),
      },
      acceptances: {
        existsForClinician: (subjectId) =>
          acceptanceRecords.some((record) => record.clinician_id === subjectId),
        listByClinician: (subjectId) =>
          acceptanceRecords.filter((record) => record.clinician_id === subjectId),
      },
      starts: {
        existsForClinician: (subjectId) => startedClinicians.has(subjectId),
      },
      audit: {
        append: createTrustStateAuditAppender(audit),
      },
      now: () => new Date(nowIso),
    };

    const getTrustState = async (subjectId: string) => resolveTrustState(subjectId, trustStateDeps);

    const receipt = psvStore.append({
      clinician_id,
      receipt: {
        source_authority: 'ABMS',
        access_or_license_id: 'LIC-DECAY-001',
        transaction_id: 'txn-decay-001',
        fetched_at: '2026-02-06T12:00:00.000Z',
        raw_response: '{"source":"ABMS","result":"ok"}',
        ttl_seconds: 1,
      },
    });

    const historicalReceiptSnapshot = receipt.toJSON();
    audit.append({
      clinician_id,
      event_type: 'PSV_RECEIPT',
      reference_id: receipt.receipt_id,
      occurred_at: '2026-02-06T12:00:00.100Z',
      metadata: { source_authority: receipt.source_authority },
    });

    const recognition = path.createRecognition({
      subjectId: clinician_id,
      employerId: employer_id,
      recognizedAt: '2026-02-06T12:00:00.500Z',
      psvReceipts: asDomainReceiptSnapshots(psvStore, [receipt.receipt_id]),
      proof: proofFor('did:key:recognition-network#key-2'),
    });
    audit.append({
      clinician_id,
      event_type: 'RECOGNITION',
      reference_id: recognition.recognitionId,
      occurred_at: '2026-02-06T12:00:00.600Z',
      metadata: {
        receipt_count: recognition.psvReceiptIds.length,
        hashAnchor: recognition.hashAnchor,
        proofType: recognition.proof.type,
        verificationMethod: recognition.proof.verificationMethod,
      },
    });

    const acceptance = path.createAcceptance({
      recognitionId: recognition.recognitionId,
      facilityId: 'facility:alpha',
      acceptedAt: '2026-02-06T12:00:00.700Z',
      countersignedAt: '2026-02-06T12:00:00.800Z',
      countersignedByEmployer: true,
      employerProof: proofFor('did:key:employer-silent-decay-001#key-1'),
    });
    acceptanceRecords.push({
      clinician_id,
      employer_id: acceptance.employerId,
      facility_id: acceptance.facilityId,
      role: acceptance.role,
      accepted_at: acceptance.acceptedAt,
      acceptance_id: acceptance.acceptanceId,
      hash_anchor: acceptance.hashAnchor,
      employer_proof: acceptance.employerProof,
    });
    audit.append({
      clinician_id,
      event_type: 'ACCEPTANCE',
      reference_id: acceptance.acceptanceId,
      occurred_at: '2026-02-06T12:00:00.900Z',
      metadata: {
        recognition_id: acceptance.recognitionId,
        hashAnchor: acceptance.hashAnchor,
        proofType: acceptance.employerProof.type,
        verificationMethod: acceptance.employerProof.verificationMethod,
      },
    });

    // Before expiry: accepted clinician is start-ready.
    nowIso = '2026-02-06T12:00:00.950Z';
    const beforeDecay = await getTrustState(clinician_id);
    expect(beforeDecay.start_ready).toBe(true);
    expect(beforeDecay.band).toBe('GREEN');

    // After TTL expiry: system auto-detects decay and blocks start.
    nowIso = '2026-02-06T12:00:03.000Z';
    const afterDecay = await getTrustState(clinician_id);
    expect(afterDecay.start_ready).toBe(false);
    expect(afterDecay.band).toBe('RED');
    expect(afterDecay.score).toBeLessThan(80);
    expect(afterDecay.blocking_reasons).toContain('EXPIRED_PSV');
    expect(afterDecay.blocking_reasons).toContain('CRS_BELOW_THRESHOLD');

    const crsAfterDecay = await crs.computeForClinician({
      clinician_id,
      as_of: nowIso,
    });
    expect(crsAfterDecay.band).toBe('RED');
    expect(crsAfterDecay.blocking_reasons).toContain('EXPIRED_PSV');

    // Start attestation is blocked once CRS decays below threshold.
    expect(() =>
      path.createStart({
        acceptanceId: acceptance.acceptanceId,
        attestedAt: '2026-02-06T12:00:03.100Z',
        crsScore: crsAfterDecay.score,
        proof: proofFor('did:key:employer-silent-decay-001#key-2'),
      }),
    ).toThrow();

    const packet = buildAuditScrapbook(clinician_id, audit.listByClinician(clinician_id));
    expect(packet.timeline.some((event) => event.event_type === 'TRUST_STATE_DECAY')).toBe(true);

    // Historical receipt record remains immutable and unchanged.
    const snapshotAfterDecay = psvStore.getById(receipt.receipt_id)?.toJSON();
    expect(snapshotAfterDecay).toEqual(historicalReceiptSnapshot);
  });
});
