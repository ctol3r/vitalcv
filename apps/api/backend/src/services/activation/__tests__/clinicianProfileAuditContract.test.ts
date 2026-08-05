/**
 * The audit helper's contract with the coverage gate — Wave 1076 B1.
 *
 * `writeActivationAudit` is in the gate's durable-helper vocabulary
 * (scripts/check-audit-coverage.ts). A name on that list is a CLAIM: that
 * calling it writes a durable AuditEvent row. If this helper ever stopped doing
 * so, the gate would keep passing and every clinician-profile route would be
 * unaudited while reporting otherwise.
 *
 * This is the test that keeps the claim true.
 */

import { writeActivationAudit } from '../clinicianProfileAudit';

describe('writeActivationAudit calls auditEvent.create', () => {
  it('writes a durable row on the client it is given', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a' });
    await writeActivationAudit('CLINICIAN_PROFILE_SAVED', 'user_1', 'draft-1', {}, {
      auditEvent: { create },
    });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.type).toBe('CLINICIAN_PROFILE_SAVED');
    expect(data.referenceId).toBe('draft-1');
    expect(data.hash).toEqual(expect.any(String));
  });

  it('uses the caller’s transaction client, not the global one', async () => {
    const txCreate = jest.fn().mockResolvedValue({ id: 'a' });
    await writeActivationAudit('CLINICIAN_PROFILE_CLAIMED', 'user_1', 'draft-1', {}, {
      auditEvent: { create: txCreate },
    });
    // If it fell back to the global client this would be 0 — and the audit
    // would commit independently of the mutation it is supposed to be atomic
    // with.
    expect(txCreate).toHaveBeenCalledTimes(1);
  });

  it('propagates a failure rather than swallowing it', async () => {
    const create = jest.fn().mockRejectedValue(new Error('audit store down'));
    await expect(
      writeActivationAudit('CLINICIAN_PROFILE_ACTIVATED', 'u', 'd', {}, { auditEvent: { create } }),
    ).rejects.toThrow(/audit store down/);
  });
});
