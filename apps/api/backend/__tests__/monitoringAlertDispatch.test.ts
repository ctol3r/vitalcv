/**
 * monitoringAlertDispatch.test.ts — monitoring alerts must reach real inboxes.
 *
 * Locks the delivery contract for continuousMonitor's alert dispatch:
 *   - recipients are real email addresses (ops inbox + resolved employer
 *     contacts), never `employer:<id>` pseudo-addresses
 *   - non-UUID employerIds never reach a prisma @db.Uuid query
 *   - one failed send does not abort delivery to remaining recipients
 *   - zero deliverable recipients short-circuits without a send
 */

const sendMock = jest.fn<Promise<void>, [string, string, string]>();
let emailConfigured = true;

jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  Prisma: {},
  default: {
    acceptance: {
      findMany: jest.fn(),
    },
    verifierOrg: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/services/providers/notificationProvider', () => ({
  __esModule: true,
  getNotificationProvider: () => ({
    send: (to: string, subject: string, body: string) => sendMock(to, subject, body),
  }),
  isEmailDeliveryConfigured: () => emailConfigured,
}));

jest.mock('../src/services/alerts/trustAlerts', () => ({
  __esModule: true,
  emitMonitoringAlert: jest.fn().mockResolvedValue({ alertId: 'alert-1' }),
}));

jest.mock('../src/services/psv/oigLeieChecker', () => ({
  __esModule: true,
  checkExclusion: jest.fn(),
}));

jest.mock('../src/services/ledger/statusListManager', () => ({
  __esModule: true,
  setRevoked: jest.fn(),
}));

jest.mock('../src/services/revocation/propagationEngine', () => ({
  __esModule: true,
  propagateCredentialLifecycleChange: jest.fn(),
}));

jest.mock('../src/services/trust-state/trustStateService', () => ({
  __esModule: true,
  computeTrustState: jest.fn(),
}));

jest.mock('../src/services/identity/npiDidBinding', () => ({
  __esModule: true,
  getBindingByNpi: jest.fn(),
}));

jest.mock('@vitalcv/psv-adapters', () => ({
  __esModule: true,
  NursysENotifyAdapter: class {},
}));

import prisma from '../src/graphql/prisma_client';
import { _testing } from '../src/workers/continuousMonitor';

const acceptanceFindMany = prisma.acceptance.findMany as jest.Mock;
const verifierOrgFindMany = prisma.verifierOrg.findMany as jest.Mock;

const EMPLOYER_UUID = '4f3b2a1c-9d8e-4f00-b1a2-c3d4e5f60789';

const ALERT_INPUT = {
  kind: 'SANCTION_DETECTED' as const,
  npi: '1841498016',
  title: 'Federal exclusion detected',
  description: 'OIG/LEIE match found for monitored clinician.',
  recommendedAction: 'Review the exclusion and suspend reliance on this passport.',
};

describe('monitoring alert dispatch', () => {
  const originalOpsInbox = process.env.MONITORING_ALERT_EMAIL;

  beforeEach(() => {
    jest.clearAllMocks();
    emailConfigured = true;
    delete process.env.MONITORING_ALERT_EMAIL;
  });

  afterAll(() => {
    if (originalOpsInbox === undefined) {
      delete process.env.MONITORING_ALERT_EMAIL;
    } else {
      process.env.MONITORING_ALERT_EMAIL = originalOpsInbox;
    }
  });

  describe('resolveEmployerAlertEmails', () => {
    test('resolves VerifierOrg contact emails for UUID employerIds only', async () => {
      acceptanceFindMany.mockResolvedValue([
        { employerId: EMPLOYER_UUID },
        { employerId: 'legacy-employer-slug' },
        { employerId: EMPLOYER_UUID },
      ]);
      verifierOrgFindMany.mockResolvedValue([
        { contactEmail: ' credentialing@employer.example ' },
      ]);

      const emails = await _testing.resolveEmployerAlertEmails('1841498016');

      expect(verifierOrgFindMany).toHaveBeenCalledWith({
        where: { id: { in: [EMPLOYER_UUID] } },
        select: { contactEmail: true },
      });
      expect(emails).toEqual(['credentialing@employer.example']);
    });

    test('never queries VerifierOrg when no employerId is UUID-shaped', async () => {
      acceptanceFindMany.mockResolvedValue([
        { employerId: 'employer-alpha' },
        { employerId: 'employer-beta' },
      ]);

      const emails = await _testing.resolveEmployerAlertEmails('1841498016');

      expect(verifierOrgFindMany).not.toHaveBeenCalled();
      expect(emails).toEqual([]);
    });

    test('drops contact values that are not email-shaped', async () => {
      acceptanceFindMany.mockResolvedValue([{ employerId: EMPLOYER_UUID }]);
      verifierOrgFindMany.mockResolvedValue([{ contactEmail: 'not-an-email' }]);

      const emails = await _testing.resolveEmployerAlertEmails('1841498016');

      expect(emails).toEqual([]);
    });
  });

  describe('dispatchMonitoringAlert', () => {
    test('sends to ops inbox and resolved employer emails, never pseudo-addresses', async () => {
      process.env.MONITORING_ALERT_EMAIL = 'founder-ops@vitalcv.com';
      acceptanceFindMany.mockResolvedValue([{ employerId: EMPLOYER_UUID }]);
      verifierOrgFindMany.mockResolvedValue([
        { contactEmail: 'credentialing@employer.example' },
      ]);
      sendMock.mockResolvedValue(undefined);

      await _testing.dispatchMonitoringAlert(ALERT_INPUT);

      const recipients = sendMock.mock.calls.map(([to]) => to);
      expect(recipients).toEqual([
        'founder-ops@vitalcv.com',
        'credentialing@employer.example',
      ]);
      for (const to of recipients) {
        expect(to).toContain('@');
        expect(to.startsWith('employer:')).toBe(false);
      }
    });

    test('short-circuits without sending when no deliverable recipient exists', async () => {
      acceptanceFindMany.mockResolvedValue([]);

      await _testing.dispatchMonitoringAlert(ALERT_INPUT);

      expect(sendMock).not.toHaveBeenCalled();
    });

    test('a failed send does not abort delivery to remaining recipients', async () => {
      process.env.MONITORING_ALERT_EMAIL = 'founder-ops@vitalcv.com';
      acceptanceFindMany.mockResolvedValue([{ employerId: EMPLOYER_UUID }]);
      verifierOrgFindMany.mockResolvedValue([
        { contactEmail: 'credentialing@employer.example' },
      ]);
      sendMock
        .mockRejectedValueOnce(new Error('resend 500'))
        .mockResolvedValueOnce(undefined);

      await _testing.dispatchMonitoringAlert(ALERT_INPUT);

      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(sendMock.mock.calls[1][0]).toBe('credentialing@employer.example');
    });

    test('still attempts stub delivery (with real addresses) when email is unconfigured', async () => {
      emailConfigured = false;
      process.env.MONITORING_ALERT_EMAIL = 'founder-ops@vitalcv.com';
      acceptanceFindMany.mockResolvedValue([]);
      sendMock.mockResolvedValue(undefined);

      await _testing.dispatchMonitoringAlert(ALERT_INPUT);

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock.mock.calls[0][0]).toBe('founder-ops@vitalcv.com');
    });
  });
});
