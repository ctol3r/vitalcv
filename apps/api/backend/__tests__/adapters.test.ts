import { CredentialPacket } from '../src/api/adapters/base';
import { GreenhouseAdapter } from '../src/api/adapters/greenhouse';
import { WorkdayAdapter } from '../src/api/adapters/workday';

describe('ATS adapters', () => {
  const packet: CredentialPacket = {
    candidateId: 'cand-123',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '(555) 867-5309',
    readinessScore: 88,
    readinessLevel: 'ready',
    readinessFactors: { boardCerts: 1, sanctions: 0 },
    npi: '1234567890',
    specialty: 'Cardiology',
    licenses: [{ state: 'CA', number: 'CA-12345', status: 'Active' }],
    credentials: [
      { id: 'cred-1', type: 'Nursing License', issuer: 'CA Board', issuedAt: '2023-01-01' },
      { id: 'cred-2', type: 'BLS', issuer: 'AHA', issuedAt: '2024-02-01', status: 'Active' },
    ],
  };

  it('maps credential packets for Greenhouse payloads', () => {
    const adapter = new GreenhouseAdapter();
    const payload = (adapter as any).buildReadinessPayload(packet, '2024-01-01T00:00:00Z');

    expect(payload).toMatchObject({
      event: 'readiness.updated',
      adapter: 'greenhouse',
      updated_at: '2024-01-01T00:00:00Z',
      candidate: {
        prospect_id: 'cand-123',
        first_name: 'Ada',
        last_name: 'Lovelace',
        custom_fields: {
          readiness_score: 88,
          readiness_level: 'ready',
          readiness_factors: { boardCerts: 1, sanctions: 0 },
          npi: '1234567890',
          specialty: 'Cardiology',
        },
        credentials: expect.arrayContaining([
          expect.objectContaining({ name: 'Nursing License', issuer: 'CA Board' }),
        ]),
      },
    });
  });

  it('maps credential packets for Workday payloads', () => {
    const adapter = new WorkdayAdapter();
    const payload = (adapter as any).buildReadinessPayload(packet, '2024-01-02T00:00:00Z');

    expect(payload).toMatchObject({
      event: 'readiness.updated',
      adapter: 'workday',
      updated_at: '2024-01-02T00:00:00Z',
      worker: {
        reference_id: 'cand-123',
        readiness: { score: 88, level: 'ready' },
        licenses: [expect.objectContaining({ state: 'CA', number: 'CA-12345' })],
        certifications: expect.arrayContaining([
          expect.objectContaining({ name: 'Nursing License', issuer: 'CA Board' }),
        ]),
      },
    });
  });

  it('returns a non-transmitted result when webhook URLs are not configured', async () => {
    delete process.env.GREENHOUSE_WEBHOOK_URL;
    const adapter = new GreenhouseAdapter();

    const result = await adapter.sendReadinessUpdate({
      target: 'greenhouse',
      event: 'readiness.updated',
      updatedAt: '2024-01-01T00:00:00Z',
      packet,
    });

    expect(result.transmitted).toBe(false);
    expect(result.reference).toBe('webhook_not_configured');
  });
});
