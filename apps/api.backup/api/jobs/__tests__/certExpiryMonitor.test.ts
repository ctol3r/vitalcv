import { runCertExpiryMonitor, CertTarget, CertCheckResult } from '../security/certExpiryMonitor';

describe('certExpiryMonitor', () => {
  it('summarizes alerts and successes', async () => {
    const targets: CertTarget[] = [
      { host: 'demo.vitalcv.com', name: 'demo' },
      { host: 'stage.vitalcv.com', name: 'stage' },
    ];

    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        host: 'demo.vitalcv.com',
        port: 443,
        valid: true,
        message: 'ok',
        expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
        daysRemaining: 20,
        alert: false,
      } as CertCheckResult)
      .mockResolvedValueOnce({
        host: 'stage.vitalcv.com',
        port: 443,
        valid: true,
        message: 'expiring soon',
        expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
        daysRemaining: 5,
        alert: true,
      } as CertCheckResult);

    const summary = await runCertExpiryMonitor({ targets, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(summary.checked).toBe(2);
    expect(summary.alerts).toBe(1);
    expect(summary.failures).toBe(0);
    expect(summary.results[1].alert).toBe(true);
  });

  it('records failures when fetcher throws', async () => {
    const targets: CertTarget[] = [{ host: 'broken.example.com' }];
    const fetcher = jest.fn().mockRejectedValueOnce(new Error('network down'));

    const summary = await runCertExpiryMonitor({ targets, fetcher });

    expect(summary.checked).toBe(1);
    expect(summary.failures).toBe(1);
    expect(summary.alerts).toBe(1);
    expect(summary.results[0].valid).toBe(false);
    expect(summary.results[0].message).toContain('network down');
  });
});

