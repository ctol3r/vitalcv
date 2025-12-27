import { NotificationDispatcher, renderCalendarInvite } from '../src/api/notifications/dispatcher';
import {
  NotificationChannel,
  NotificationTrigger,
} from '../src/api/notifications/models';

describe('NotificationDispatcher', () => {
  test('dispatches to configured actionable channels and builds calendar events', async () => {
    const emailHandler = jest.fn(async () => ({
      channel: NotificationChannel.Email,
      trigger: NotificationTrigger.RenewalWindowOpen,
      status: 'sent',
    }));

    const calendarHandler = jest.fn(async (envelope) => {
      expect(envelope.calendarEvent).toBeDefined();
      expect(envelope.calendarEvent?.summary).toContain('Renewal window');
      return {
        channel: NotificationChannel.CalendarIcs,
        trigger: NotificationTrigger.RenewalWindowOpen,
        status: 'sent',
      };
    });

    const dispatcher = new NotificationDispatcher({
      [NotificationChannel.Email]: emailHandler,
      [NotificationChannel.CalendarIcs]: calendarHandler,
    });

    const results = await dispatcher.dispatch({
      trigger: NotificationTrigger.RenewalWindowOpen,
      channels: [NotificationChannel.Email, NotificationChannel.CalendarIcs],
      audience: { email: 'clinician@example.com' },
      context: {
        credentialName: 'Nursing License',
        renewalWindowOpensAt: '2030-01-10T00:00:00.000Z',
        actionUrl: 'https://vitalcv.example/renew',
      },
    });

    expect(emailHandler).toHaveBeenCalledTimes(1);
    expect(calendarHandler).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'sent')).toBe(true);
  });

  test('skips channels that are not configured', async () => {
    const dispatcher = new NotificationDispatcher({});

    const results = await dispatcher.dispatch({
      trigger: NotificationTrigger.CredentialExpiring,
      channels: [NotificationChannel.Email],
      audience: { email: 'clinician@example.com' },
      context: {
        credentialName: 'DEA Registration',
        expiresAt: '2030-12-01T00:00:00.000Z',
      },
    });

    expect(results).toEqual([
      {
        channel: NotificationChannel.Email,
        trigger: NotificationTrigger.CredentialExpiring,
        status: 'skipped',
        detail: 'Channel not configured.',
      },
    ]);
  });

  test('suppresses notifications when action is not required', async () => {
    const handler = jest.fn();
    const dispatcher = new NotificationDispatcher({
      [NotificationChannel.Email]: handler,
    });

    const results = await dispatcher.dispatch({
      trigger: NotificationTrigger.EligibilityRegained,
      channels: [NotificationChannel.Email],
      audience: { email: 'clinician@example.com' },
      context: { eligibilityRegainedAt: '2030-06-01T00:00:00.000Z' },
      requiresAction: false,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(results).toEqual([
      {
        channel: NotificationChannel.Email,
        trigger: NotificationTrigger.EligibilityRegained,
        status: 'skipped',
        detail: 'No action required; notification suppressed.',
      },
    ]);
  });
});

describe('renderCalendarInvite', () => {
  test('renders a minimal ICS invite with expected fields', () => {
    const ics = renderCalendarInvite(
      {
        summary: 'Credential expiring - action needed',
        description: 'Credential is expiring and must be renewed.',
        startIso: '2030-01-01T12:00:00.000Z',
        endIso: '2030-01-01T12:30:00.000Z',
        url: 'https://vitalcv.example/action',
      },
      'test-uid-123',
    );

    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:test-uid-123');
    expect(ics).toContain('SUMMARY:Credential expiring - action needed');
    expect(ics).toContain('DTSTART:20300101T120000Z');
    expect(ics).toContain('DTEND:20300101T123000Z');
    expect(ics).toContain('URL:https://vitalcv.example/action');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });
});
