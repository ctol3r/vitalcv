import { beforeEach, describe, expect, it, vi } from 'vitest';

// expo-notifications is a native module and cannot be imported under the node
// test environment. NotificationService reads two enums off the module directly
// (rather than through its injected adapter), so mirror just those. Values are
// taken from the installed package, not invented:
//   SchedulableTriggerInputTypes.DATE = 'date'
//   AndroidImportance.HIGH            = 6
vi.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 6 },
}));

import { NotificationService } from '../NotificationService';
import type { StoredCredential } from '../LocalCredentialStore';

const DAY_MS = 86_400_000;

function credential(overrides: Partial<StoredCredential> = {}): StoredCredential {
  return {
    id: 'cred-1',
    npi: '1234567890',
    type: 'MedicalLicense',
    issuer: 'VitalCV State Board',
    status: 'VALID',
    issuedAt: new Date(Date.now() - 365 * DAY_MS).toISOString(),
    vcJwt: 'header.payload.signature',
    claims: {},
    issuerDid: 'did:key:z6Mkissuer',
    proofAlgorithm: 'EdDSA',
    ...overrides,
  };
}

function createAdapter() {
  const scheduled: { content: unknown; trigger: unknown }[] = [];
  const channels: { id: string; config: unknown }[] = [];

  return {
    scheduled,
    channels,
    adapter: {
      getPermissionsAsync: vi.fn(async () => ({ granted: true })),
      requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
      // Params are declared as `readonly unknown[]` and narrowed inside: vi.fn's
      // inferred signature is `(...args: readonly unknown[]) => unknown`, and a
      // more specific parameter type is not assignable to it.
      setNotificationChannelAsync: vi.fn(async (...args: readonly unknown[]) => {
        const [id, config] = args as [string, unknown];
        channels.push({ id, config });
        return null;
      }),
      scheduleNotificationAsync: vi.fn(async (...args: readonly unknown[]) => {
        const [request] = args as [{ content: unknown; trigger: unknown }];
        scheduled.push({ content: request.content, trigger: request.trigger });
        return 'notification-id';
      }),
      cancelAllScheduledNotificationsAsync: vi.fn(async () => undefined),
    },
  };
}

// The adapter is a structural subset of the expo-notifications module surface;
// the cast keeps the fake free of the module's full type without weakening the
// production signature.
function serviceWith(adapter: ReturnType<typeof createAdapter>) {
  return new NotificationService(adapter.adapter as never);
}

describe('NotificationService expiry reminders', () => {
  let harness: ReturnType<typeof createAdapter>;

  beforeEach(() => {
    harness = createAdapter();
  });

  // REGRESSION: the trigger previously omitted `type`, which made it
  // structurally a ChannelAwareTriggerInput ("deliver immediately"). tsc passed
  // and every reminder fired at once. Assert the discriminant explicitly —
  // this is the only layer that can catch it.
  it('schedules a DATE-triggered reminder, not an immediate one', async () => {
    const expiresAt = new Date(Date.now() + 120 * DAY_MS);
    await serviceWith(harness).scheduleCredentialExpiryReminders([
      credential({ expiresAt: expiresAt.toISOString() }),
    ]);

    expect(harness.scheduled).toHaveLength(3); // 90 / 30 / 7 days before

    for (const { trigger } of harness.scheduled) {
      expect(trigger).toMatchObject({
        type: 'date',
        channelId: 'credential-alerts',
      });
      expect((trigger as { date: Date }).date).toBeInstanceOf(Date);
      // A bare { channelId, date } is what the bug produced. It must not recur.
      expect(trigger).not.toEqual({ channelId: 'credential-alerts', date: expect.anything() });
    }
  });

  it('places each reminder at the documented 90/30/7-day offset', async () => {
    const expiresAt = new Date(Date.now() + 120 * DAY_MS);
    await serviceWith(harness).scheduleCredentialExpiryReminders([
      credential({ expiresAt: expiresAt.toISOString() }),
    ]);

    const offsets = harness.scheduled
      .map(({ trigger }) =>
        Math.round((expiresAt.getTime() - (trigger as { date: Date }).date.getTime()) / DAY_MS),
      )
      .sort((a, b) => b - a);

    expect(offsets).toEqual([90, 30, 7]);
  });

  it('skips reminder dates that have already passed', async () => {
    // 10 days out: the 90- and 30-day reminders are in the past, only 7 remains.
    const expiresAt = new Date(Date.now() + 10 * DAY_MS);
    await serviceWith(harness).scheduleCredentialExpiryReminders([
      credential({ expiresAt: expiresAt.toISOString() }),
    ]);

    expect(harness.scheduled).toHaveLength(1);
    expect((harness.scheduled[0].trigger as { type: string }).type).toBe('date');
  });

  it('ignores credentials with no or unparseable expiry', async () => {
    await serviceWith(harness).scheduleCredentialExpiryReminders([
      credential({ id: 'no-expiry', expiresAt: undefined }),
      credential({ id: 'bad-expiry', expiresAt: 'not-a-date' }),
    ]);

    expect(harness.scheduled).toHaveLength(0);
  });

  it('schedules nothing when permission is denied', async () => {
    harness.adapter.getPermissionsAsync = vi.fn(async () => ({ granted: false }));
    harness.adapter.requestPermissionsAsync = vi.fn(async () => ({ granted: false }));

    await serviceWith(harness).scheduleCredentialExpiryReminders([
      credential({ expiresAt: new Date(Date.now() + 120 * DAY_MS).toISOString() }),
    ]);

    expect(harness.scheduled).toHaveLength(0);
    expect(harness.adapter.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('NotificationService immediate alerts', () => {
  // The counterpart to the regression above: immediate delivery is expressed by
  // `trigger: null`, deliberately and not by omitting a discriminant. If these
  // two ever produce the same trigger shape again, one of them is wrong.
  it('sends immediate alerts with a null trigger', async () => {
    const harness = createAdapter();
    await serviceWith(harness).sendImmediateAlert(
      'sanction_alert',
      'Sanction recorded',
      'A sanction was recorded against your NPI.',
      { sourceId: 'oig' },
    );

    expect(harness.scheduled).toHaveLength(1);
    expect(harness.scheduled[0].trigger).toBeNull();
    expect(harness.scheduled[0].content).toMatchObject({
      title: 'Sanction recorded',
      data: { type: 'sanction_alert', sourceId: 'oig' },
    });
  });

  it('configures the Android channel once across repeated sends', async () => {
    const harness = createAdapter();
    const service = serviceWith(harness);

    await service.sendImmediateAlert('trust_state_updated', 'A', 'a');
    await service.sendImmediateAlert('trust_state_updated', 'B', 'b');

    expect(harness.channels).toHaveLength(1);
    expect(harness.channels[0]).toMatchObject({
      id: 'credential-alerts',
      config: { name: 'Credential Alerts', importance: 6 },
    });
  });
});
