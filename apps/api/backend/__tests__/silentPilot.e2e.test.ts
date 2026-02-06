import { resolveTrustState, type TrustStateApiDependencies } from '../../trust-state';
import { CanonicalPathService } from '../../domain';
import type { PsvReceiptSnapshot } from '../../../../packages/domain-core';
import { CrsEngine } from '../../../../packages/crs';
import { AuditLedger, buildAuditScrapbook } from '../../../../packages/audit';
import { PsvStore } from '../../../../packages/psv';

describe('silentPilot.e2e', () => {
  it('enforces Recognition -> Acceptance -> Start with trust-state as the only decision surface', async () => {
    const clinician_id = 'did:key:clinician-silent-001';
    const employer_id = 'did:key:employer-silent-001';

    const path = new CanonicalPathService();
    const psvStore = new PsvStore();
    const audit = new AuditLedger();

    const acceptedClinicians = new Set<string>();
    const startedClinicians = new Set<string>();

    const crs = new CrsEngine({
      receipts: {
        listByClinician: (subjectId) => psvStore.listByClinician(subjectId),
      },
      acceptances: {
        existsForClinician: (subjectId) => acceptedClinicians.has(subjectId),
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
        existsForClinician: (subjectId) => acceptedClinicians.has(subjectId),
      },
      starts: {
        existsForClinician: (subjectId) => startedClinicians.has(subjectId),
      },
      audit: {
        append: ({ clinician_id: subjectId, occurred_at, metadata }) => {
          audit.append({
            clinician_id: subjectId,
            event_type: 'TRUST_STATE_CHECK',
            reference_id: `trust-${subjectId}-${occurred_at}`,
            occurred_at,
            metadata,
          });

          const packet = buildAuditScrapbook(subjectId, audit.listByClinician(subjectId));
          return { audit_packet_id: packet.audit_packet_id };
        },
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
      }),
    ).toThrow();

    expect(() =>
      path.createStart({
        acceptanceId: 'missing-acceptance',
        attestedAt: '2026-02-06T10:20:00.000Z',
        crsScore: 95,
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
    const receiptSnapshots: PsvReceiptSnapshot[] = psvStore.listByIds([receipt.receipt_id]).map((value) => ({
      receiptId: value.receipt_id,
      fetchedAt: value.fetched_at,
      ttlSeconds: value.ttl_seconds,
      revoked: value.revoked,
    }));

    const recognition = path.createRecognition({
      subjectId: clinician_id,
      employerId: employer_id,
      recognizedAt: '2026-02-06T10:05:00.000Z',
      psvReceipts: receiptSnapshots,
    });

    audit.append({
      clinician_id,
      event_type: 'RECOGNITION',
      reference_id: recognition.recognitionId,
      occurred_at: '2026-02-06T10:05:01.000Z',
      metadata: { receipt_count: recognition.psvReceiptIds.length },
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
    });
    acceptedClinicians.add(clinician_id);

    audit.append({
      clinician_id,
      event_type: 'ACCEPTANCE',
      reference_id: acceptance.acceptanceId,
      occurred_at: '2026-02-06T10:11:01.000Z',
      metadata: { recognition_id: acceptance.recognitionId },
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
    });
    startedClinicians.add(clinician_id);

    audit.append({
      clinician_id,
      event_type: 'START',
      reference_id: start.startId,
      occurred_at: '2026-02-06T10:20:01.000Z',
      metadata: { acceptance_id: start.acceptanceId },
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
});
