import { InMemoryTrustAlertsRepository } from '../repositories/trustAlerts.repo';
import {
  acknowledgeAlert,
  emitAlert,
  getAlert,
  initializeTrustAlertsPersistence,
  listAlerts,
  resetTrustAlertsRepository,
  setTrustAlertsRepository,
  unacknowledgedCount,
} from '../src/services/alerts/trustAlerts';

describe('trustAlerts persistence', () => {
  let repository: InMemoryTrustAlertsRepository;

  beforeEach(async () => {
    repository = new InMemoryTrustAlertsRepository();
    setTrustAlertsRepository(repository);
    await initializeTrustAlertsPersistence();
  });

  afterEach(() => {
    resetTrustAlertsRepository();
  });

  test('persists emitted alerts across cache reinitialization', async () => {
    const emitted = await emitAlert({
      type: 'verification_failure',
      severity: 'WARNING',
      title: 'Missing issuer key',
      description: 'Issuer key is missing from trust registry.',
      issuerId: 'did:vitalcv:test:issuer',
      recommendedAction: 'Register the issuer public key.',
    });

    setTrustAlertsRepository(repository);
    await initializeTrustAlertsPersistence();

    const alert = getAlert(emitted.alertId);
    expect(alert).not.toBeNull();
    expect(alert?.title).toBe('Missing issuer key');
    expect(listAlerts({ limit: 1 })[0]?.alertId).toBe(emitted.alertId);
  });

  test('persists acknowledgement state', async () => {
    const emitted = await emitAlert({
      type: 'credential_revoked',
      severity: 'CRITICAL',
      title: 'Revocation detected',
      description: 'Credential has been revoked.',
      credentialId: 'cred-persist-1',
      issuerId: 'did:vitalcv:test:issuer',
      recommendedAction: 'Invalidate downstream sessions.',
    });

    await acknowledgeAlert(emitted.alertId);

    setTrustAlertsRepository(repository);
    await initializeTrustAlertsPersistence();

    const alert = getAlert(emitted.alertId);
    expect(alert?.acknowledged).toBe(true);
    expect(alert?.acknowledgedAt).toBeDefined();
    expect(unacknowledgedCount()).toBe(listAlerts().filter((entry) => !entry.acknowledged).length);
  });
});
