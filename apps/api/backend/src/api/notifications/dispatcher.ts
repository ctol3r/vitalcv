import crypto from 'crypto';
import {
  CalendarEventSpec,
  CredentialActionContext,
  NotificationChannel,
  NotificationEnvelope,
  NotificationInstruction,
  NotificationResult,
  NotificationTrigger,
  defaultSubjectForTrigger,
  describeTrigger,
  isActionRequiredTrigger,
  normalizeChannels,
  resolveActionTimestamp,
} from './models';

type ChannelHandler = (envelope: NotificationEnvelope) => Promise<NotificationResult>;

export interface NotificationDispatcherOptions {
  fallbackDurationMinutes?: number;
}

function isoDate(input?: string | null): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function addMinutes(dateIso: string, minutes: number): string {
  const date = new Date(dateIso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function buildActionDescription(trigger: NotificationTrigger, context: CredentialActionContext): string {
  const credentialName = context.credentialName ? ` for ${context.credentialName}` : '';
  const issuerName = context.issuerName ? ` issued by ${context.issuerName}` : '';
  const actionUrl = context.actionUrl ? ` Complete the action at ${context.actionUrl}.` : '';

  return `${describeTrigger(trigger)}${credentialName}${issuerName}.${actionUrl}`.trim();
}

function toIcsDateTime(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function renderCalendarInvite(event: CalendarEventSpec, uid?: string): string {
  const eventUid = uid || crypto.randomUUID();
  const dtStamp = toIcsDateTime(new Date().toISOString());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VitalCV//Notification Orchestrator//EN',
    'BEGIN:VEVENT',
    `UID:${eventUid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${toIcsDateTime(event.startIso)}`,
    `DTEND:${toIcsDateTime(event.endIso)}`,
    `SUMMARY:${event.summary}`,
    `DESCRIPTION:${event.description}`,
    event.url ? `URL:${event.url}` : null,
    event.location ? `LOCATION:${event.location}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
    .concat('\r\n');
}

function buildCalendarEvent(
  trigger: NotificationTrigger,
  context: CredentialActionContext,
  summary: string,
  description: string,
  options?: NotificationDispatcherOptions,
): CalendarEventSpec | null {
  const actionAtIso = isoDate(resolveActionTimestamp(trigger, context));
  if (!actionAtIso) return null;

  const durationMinutes = options?.fallbackDurationMinutes ?? 30;
  const endIso = addMinutes(actionAtIso, durationMinutes);

  return {
    summary,
    description,
    startIso: actionAtIso,
    endIso,
    url: context.actionUrl,
  };
}

export class NotificationDispatcher {
  private readonly handlers: Partial<Record<NotificationChannel, ChannelHandler>>;

  private readonly options: NotificationDispatcherOptions;

  constructor(
    handlers: Partial<Record<NotificationChannel, ChannelHandler>>,
    options: NotificationDispatcherOptions = {},
  ) {
    this.handlers = handlers;
    this.options = options;
  }

  async dispatch(instruction: NotificationInstruction): Promise<NotificationResult[]> {
    const channels = normalizeChannels(instruction.channels);
    const requiresAction =
      instruction.requiresAction ?? isActionRequiredTrigger(instruction.trigger);

    const envelopes = channels.map((channel) =>
      this.buildEnvelope(channel, instruction, requiresAction),
    );

    const results: NotificationResult[] = [];

    for (const envelope of envelopes) {
      if (!envelope.requiresAction) {
        results.push({
          channel: envelope.channel,
          trigger: envelope.trigger,
          status: 'skipped',
          detail: 'No action required; notification suppressed.',
        });
        continue;
      }

      if (envelope.channel === NotificationChannel.CalendarIcs && !envelope.calendarEvent) {
        results.push({
          channel: envelope.channel,
          trigger: envelope.trigger,
          status: 'skipped',
          detail: 'No actionable window available for calendar invite.',
        });
        continue;
      }

      const handler = this.handlers[envelope.channel];
      if (!handler) {
        results.push({
          channel: envelope.channel,
          trigger: envelope.trigger,
          status: 'skipped',
          detail: 'Channel not configured.',
        });
        continue;
      }

      try {
        const result = await handler(envelope);
        results.push(result);
      } catch (error) {
        results.push({
          channel: envelope.channel,
          trigger: envelope.trigger,
          status: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown dispatch error.',
        });
      }
    }

    return results;
  }

  private buildEnvelope(
    channel: NotificationChannel,
    instruction: NotificationInstruction,
    requiresAction: boolean,
  ): NotificationEnvelope {
    const subject = defaultSubjectForTrigger(instruction.trigger);
    const description = buildActionDescription(instruction.trigger, instruction.context);

    const base: NotificationEnvelope = {
      trigger: instruction.trigger,
      channel,
      audience: instruction.audience,
      content: {
        subject,
        body: description,
      },
      requiresAction,
      correlationId: instruction.correlationId,
    };

    if (channel === NotificationChannel.CalendarIcs) {
      base.calendarEvent = buildCalendarEvent(
        instruction.trigger,
        instruction.context,
        subject,
        description,
        this.options,
      ) ?? undefined;
    }

    return base;
  }
}
