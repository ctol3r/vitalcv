/** YC MVP — behavior frozen. Do not modify without scope approval. */
import { describe, expect, it } from 'vitest';
import { buildAuditScrapbook } from '../AuditScrapbook';
import { AuditLedger } from '../auditLedger';
import { buildTimeline } from '../timeline';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

describe('buildTimeline', () => {
  it('orders events deterministically by occurred_at then event_id', () => {
    const ledger = new AuditLedger();
    const clinician_id = 'did:key:clin-timeline-1';

    ledger.append({
      audit_event_id: '00000000-0000-4000-8000-000000000333',
      clinician_id,
      event_type: 'START',
      reference_id: 'start-1',
      occurred_at: '2026-02-07T10:00:03.000Z',
      metadata: {
        employer_id: 'did:key:employer-z',
        facility_id: 'facility:z',
        role: 'role:rn',
        attested_at: '2026-02-07T10:00:03.000Z',
        hashAnchor: HASH_A,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:employer-z#key-1',
      },
    });

    ledger.append({
      audit_event_id: '00000000-0000-4000-8000-000000000222',
      clinician_id,
      event_type: 'EMPLOYER_ACCEPTANCE',
      reference_id: 'acc-2',
      occurred_at: '2026-02-07T10:00:02.000Z',
      metadata: {
        employer_id: 'did:key:employer-b',
        facility_id: 'facility:b',
        role: 'role:rn',
        accepted_at: '2026-02-07T10:00:02.000Z',
        hashAnchor: HASH_B,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:employer-b#key-1',
      },
    });

    ledger.append({
      audit_event_id: '00000000-0000-4000-8000-000000000111',
      clinician_id,
      event_type: 'EMPLOYER_ACCEPTANCE',
      reference_id: 'acc-1',
      occurred_at: '2026-02-07T10:00:02.000Z',
      metadata: {
        employer_id: 'did:key:employer-a',
        facility_id: 'facility:a',
        role: 'role:rn',
        accepted_at: '2026-02-07T10:00:02.000Z',
        hashAnchor: HASH_C,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:employer-a#key-1',
      },
    });

    ledger.append({
      audit_event_id: '00000000-0000-4000-8000-000000000000',
      clinician_id,
      event_type: 'RECOGNITION',
      reference_id: 'rec-1',
      occurred_at: '2026-02-07T10:00:01.000Z',
      metadata: {
        receipt_count: 1,
        hashAnchor: HASH_A,
        proofType: 'Ed25519Signature2020',
        verificationMethod: 'did:key:recognition#key-1',
      },
    });

    const packet = buildAuditScrapbook(clinician_id, ledger.listByClinician(clinician_id));
    const timeline = buildTimeline(clinician_id, { audit_packet: packet });

    expect(timeline.map((entry) => entry.event_type)).toEqual([
      'RECOGNITION',
      'EMPLOYER_ACCEPTANCE',
      'EMPLOYER_ACCEPTANCE',
      'START',
    ]);

    expect(timeline[0].metadata_summary).toBe('receipt_count=1');
    expect(timeline[1].employer_id).toBe('did:key:employer-a');
    expect(timeline[2].employer_id).toBe('did:key:employer-b');
  });

  it('does not mutate audit store and can return a limited tail window', () => {
    const ledger = new AuditLedger();
    const clinician_id = 'did:key:clin-timeline-2';

    for (let idx = 0; idx < 6; idx += 1) {
      ledger.append({
        audit_event_id: `00000000-0000-4000-8000-00000000010${idx}`,
        clinician_id,
        event_type: 'TRUST_STATE_CHECK',
        reference_id: `check-${idx}`,
        occurred_at: `2026-02-07T10:00:0${idx}.000Z`,
        metadata: {
          score: 90,
          band: 'GREEN',
        },
      });
    }

    const before = ledger.listByClinician(clinician_id).map((event) => event.toJSON());
    const packet = buildAuditScrapbook(clinician_id, ledger.listByClinician(clinician_id));

    const preview = buildTimeline(clinician_id, { audit_packet: packet, limit: 5 });

    expect(preview).toHaveLength(5);
    expect(preview.map((entry) => entry.occurred_at)).toEqual([
      '2026-02-07T10:00:01.000Z',
      '2026-02-07T10:00:02.000Z',
      '2026-02-07T10:00:03.000Z',
      '2026-02-07T10:00:04.000Z',
      '2026-02-07T10:00:05.000Z',
    ]);

    const after = ledger.listByClinician(clinician_id).map((event) => event.toJSON());
    expect(after).toEqual(before);
  });
});
