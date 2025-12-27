export enum NotificationChannel {
  Email = 'email',
  CalendarIcs = 'calendar_ics',
}

export enum NotificationTrigger {
  CredentialExpiring = 'credential_expiring',
  RenewalWindowOpen = 'renewal_window_open',
  EligibilityRegained = 'eligibility_regained',
}

export interface NotificationAudience {
  userId?: number;
  email?: string;
  displayName?: string;
  timezone?: string;
}

export interface CredentialActionContext {
  credentialId?: string;
  credentialName?: string;
  issuerName?: string;
  expiresAt?: string;
  renewalWindowOpensAt?: string;
  eligibilityRegainedAt?: string;
  actionUrl?: string;
}

export interface NotificationInstruction {
  trigger: NotificationTrigger;
  channels: NotificationChannel[];
  audience: NotificationAudience;
  context: CredentialActionContext;
  correlationId?: string;
  requiresAction?: boolean;
}

export interface NotificationMessage {
  subject: string;
  body: string;
}

export interface CalendarEventSpec {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  url?: string;
  location?: string;
}

export interface NotificationEnvelope {
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  audience: NotificationAudience;
  content: NotificationMessage;
  calendarEvent?: CalendarEventSpec;
  metadata?: Record<string, unknown>;
  requiresAction: boolean;
  correlationId?: string;
}

export type DispatchStatus = 'sent' | 'skipped' | 'failed';

export interface NotificationResult {
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  status: DispatchStatus;
  detail?: string;
}

export const TRIGGER_DEFINITIONS: Record<
  NotificationTrigger,
  { description: string; requiresAction: boolean; defaultSubject: string }
> = {
  [NotificationTrigger.CredentialExpiring]: {
    description: 'Credential is expiring and must be renewed.',
    requiresAction: true,
    defaultSubject: 'Credential expiring - action needed',
  },
  [NotificationTrigger.RenewalWindowOpen]: {
    description: 'Renewal window opened; renewal should be completed.',
    requiresAction: true,
    defaultSubject: 'Renewal window open - please renew',
  },
  [NotificationTrigger.EligibilityRegained]: {
    description: 'Eligibility has been restored and action can resume.',
    requiresAction: true,
    defaultSubject: 'Eligibility regained - resume credentialing',
  },
};

export function normalizeChannels(channels: NotificationChannel[]): NotificationChannel[] {
  return Array.from(new Set(channels));
}

export function isActionRequiredTrigger(trigger: NotificationTrigger): boolean {
  return Boolean(TRIGGER_DEFINITIONS[trigger]?.requiresAction);
}

export function defaultSubjectForTrigger(trigger: NotificationTrigger): string {
  return TRIGGER_DEFINITIONS[trigger]?.defaultSubject ?? 'Credential notification';
}

export function resolveActionTimestamp(
  trigger: NotificationTrigger,
  context: CredentialActionContext,
): string | null {
  switch (trigger) {
    case NotificationTrigger.CredentialExpiring:
      return context.expiresAt ?? null;
    case NotificationTrigger.RenewalWindowOpen:
      return context.renewalWindowOpensAt ?? context.expiresAt ?? null;
    case NotificationTrigger.EligibilityRegained:
      return context.eligibilityRegainedAt ?? null;
    default:
      return null;
  }
}

export function describeTrigger(trigger: NotificationTrigger): string {
  return TRIGGER_DEFINITIONS[trigger]?.description ?? trigger;
}
