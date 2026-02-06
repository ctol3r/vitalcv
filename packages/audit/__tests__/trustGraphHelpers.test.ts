import { describe, expect, it } from 'vitest';
import { AuditLedger } from '../auditLedger';
import { buildAuditScrapbook } from '../AuditScrapbook';
import { listCliniciansForEmployer, listEmployersForClinician } from '../trustGraph';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

describe('trust graph helpers', () => {
  it('returns two unique employers for one clinician with stable ordering', () => {
    const ledger = new AuditLedger();
    const clinician_id = 'did:key:clin-graph-1';

    ledger.append({
      clinician_id,
      event_type: 'PSV_RECEIPT',
      reference_id: 'psv-1',
      occurred_at: '2026-02-07T10:00:00.000Z',
      metadata: { source_authority: 'ABMS' },
    });

    ledger.append({
      clinician_id,
      event_type: 'PSV_RECEIPT',
      reference_id: 'psv-1-duplicate-check',
      occurred_at: '2026-02-07T10:00:00.500Z',
      metadata: { source_authority: 'ABMS' },
    });

    ledger.append({
      clinician_id,
      event_type: 'RECOGNITION',
      reference_id: 'rec-1',
      occurred_at: '2026-02-07T10:00:01.000Z',
      metadata: {
        employer_id: 'did:key:network',
        hashAnchor: HASH_A,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:network#key-1',
      },
    });

    ledger.append({
      clinician_id,
      event_type: 'EMPLOYER_ACCEPTANCE',
      reference_id: 'acc-b',
      occurred_at: '2026-02-07T10:00:03.000Z',
      metadata: {
        employer_id: 'did:key:employer-B',
        facility_id: 'facility:B',
        role: 'role:rn',
        hashAnchor: HASH_B,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:employer-B#key-1',
      },
    });

    ledger.append({
      clinician_id,
      event_type: 'EMPLOYER_ACCEPTANCE',
      reference_id: 'acc-a',
      occurred_at: '2026-02-07T10:00:02.000Z',
      metadata: {
        employer_id: 'did:key:employer-A',
        facility_id: 'facility:A',
        role: 'role:rn',
        hashAnchor: HASH_C,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:employer-A#key-1',
      },
    });

    const packet = buildAuditScrapbook(clinician_id, ledger.listByClinician(clinician_id));
    const employers = listEmployersForClinician(clinician_id, packet);

    expect(employers).toEqual([
      {
        employer_id: 'did:key:employer-A',
        facility_id: 'facility:A',
        role: 'role:rn',
      },
      {
        employer_id: 'did:key:employer-B',
        facility_id: 'facility:B',
        role: 'role:rn',
      },
    ]);

    // Traversal should not duplicate/derive from PSV events.
    expect(packet.timeline.filter((event) => event.event_type === 'PSV_RECEIPT')).toHaveLength(2);
    expect(employers).toHaveLength(2);
  });

  it('returns three unique clinicians for an employer with deterministic ordering', () => {
    const ledger = new AuditLedger();

    const clinicians = ['did:key:clin-1', 'did:key:clin-2', 'did:key:clin-3'];
    clinicians.forEach((clinician_id, index) => {
      ledger.append({
        clinician_id,
        event_type: 'EMPLOYER_ACCEPTANCE',
        reference_id: `acc-${index + 1}`,
        occurred_at: `2026-02-07T10:00:0${index}.000Z`,
        metadata: {
          employer_id: 'did:key:employer-X',
          facility_id: `facility:${index + 1}`,
          role: 'role:rn',
          hashAnchor: HASH_A,
          proofType: 'Ed25519Signature2020',
          verificationMethod: `did:key:employer-X#key-${index + 1}`,
        },
      });
    });

    // Noise event for another employer should not be included.
    ledger.append({
      clinician_id: 'did:key:clin-4',
      event_type: 'EMPLOYER_ACCEPTANCE',
      reference_id: 'acc-other',
      occurred_at: '2026-02-07T10:00:09.000Z',
      metadata: {
        employer_id: 'did:key:employer-Y',
        facility_id: 'facility:other',
        role: 'role:rn',
        hashAnchor: HASH_B,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:employer-Y#key-1',
      },
    });

    const packets = [
      buildAuditScrapbook('did:key:clin-3', ledger.listByClinician('did:key:clin-3')),
      buildAuditScrapbook('did:key:clin-1', ledger.listByClinician('did:key:clin-1')),
      buildAuditScrapbook('did:key:clin-2', ledger.listByClinician('did:key:clin-2')),
      buildAuditScrapbook('did:key:clin-4', ledger.listByClinician('did:key:clin-4')),
    ];

    const first = listCliniciansForEmployer('did:key:employer-X', packets);
    const second = listCliniciansForEmployer('did:key:employer-X', [...packets].reverse());

    expect(first).toEqual(['did:key:clin-1', 'did:key:clin-2', 'did:key:clin-3']);
    expect(second).toEqual(first);
  });
});
