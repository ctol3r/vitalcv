import { InMemoryAuditReceiptsRepository } from '../repositories/auditReceipts.repo';
import {
  generateVerificationReceipt,
  getReceipt,
  listReceipts,
  receiptStats,
  resetAuditReceiptsRepository,
  setAuditReceiptsRepository,
} from '../src/services/audit/receiptGenerator';

describe('audit receipt persistence', () => {
  let repository: InMemoryAuditReceiptsRepository;

  beforeEach(() => {
    repository = new InMemoryAuditReceiptsRepository();
    setAuditReceiptsRepository(repository);
  });

  afterEach(() => {
    resetAuditReceiptsRepository();
  });

  test('persists generated receipts across repository reinitialization', async () => {
    const receipt = await generateVerificationReceipt({
      credentialId: 'cred-001',
      verifier: 'did:vitalcv:verifier:test',
      subject: 'npi:1234567890',
      valid: true,
      checks: {
        signature: true,
        issuerTrusted: true,
        statusActive: true,
        notExpired: true,
      },
      haipCompliant: true,
      errors: [],
    });

    setAuditReceiptsRepository(repository);

    const persisted = await getReceipt(receipt.receiptId);
    expect(persisted).not.toBeNull();
    expect(persisted?.hash).toBe(receipt.hash);
    expect((persisted?.payload as { credentialId?: string }).credentialId).toBe('cred-001');
  });

  test('lists receipts and computes stats from persisted metadata', async () => {
    await generateVerificationReceipt({
      credentialId: 'cred-002',
      verifier: 'did:vitalcv:verifier:test',
      subject: 'npi:1234567890',
      valid: false,
      checks: {
        signature: false,
        issuerTrusted: true,
        statusActive: true,
        notExpired: true,
      },
      errors: ['Signature verification failed'],
    });

    const receipts = await listReceipts('VERIFICATION');
    const stats = await receiptStats();

    expect(receipts).toHaveLength(1);
    expect(stats.VERIFICATION).toBe(1);
    expect(stats.ISSUANCE).toBe(0);
    expect(stats.PRESENTATION).toBe(0);
  });
});
