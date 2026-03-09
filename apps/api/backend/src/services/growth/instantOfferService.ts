/**
 * Wave 193 — Instant Offers, Lifecycle Messaging, and Growth Loops
 *
 * Triggers:
 *   - MATCHA eligibility (band === CLEAR + prequalified)
 *   - Assessment completion
 *   - Employer demand spikes
 *
 * Notification model: in-app (stored) + email/SMS stub ready.
 * Growth loops: holder (share → refer → assess → unlock) + verifier (post → review → offer).
 */

import { randomUUID } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationType =
  | 'INSTANT_OFFER'
  | 'CLEAR_TO_START'
  | 'ONBOARDING_REMINDER'
  | 'ASSESSMENT_UNLOCK'
  | 'NEW_ELIGIBLE_EMPLOYER'
  | 'DEMAND_SPIKE';

export interface InstantOfferNotification {
  notificationId: string;
  npi: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  opportunityId?: string;
  employerSlug?: string;
  actionUrl: string;
  sentAt: string;
  readAt?: string;
  actedAt?: string;
}

export interface LifecycleEvent {
  eventId: string;
  npi: string;
  trigger: string;
  message: string;
  actionUrl: string;
  ts: string;
}

// ── Analytics counters ────────────────────────────────────────────────────────

interface GrowthAnalytics {
  instantOffersSent: number;
  instantOffersOpened: number;
  instantOffersAccepted: number;
  reactivations: number;
  holderShareEvents: number;
  holderReferralClicks: number;
  assessmentsCompleted: number;
  verifierPostsPublished: number;
}

const analytics: GrowthAnalytics = {
  instantOffersSent: 0,
  instantOffersOpened: 0,
  instantOffersAccepted: 0,
  reactivations: 0,
  holderShareEvents: 0,
  holderReferralClicks: 0,
  assessmentsCompleted: 0,
  verifierPostsPublished: 0,
};

// ── In-memory stores ──────────────────────────────────────────────────────────

const notificationStore = new Map<string, InstantOfferNotification[]>();  // npi → notifications
const lifecycleStore    = new Map<string, LifecycleEvent[]>();            // npi → events

// ── Notification helpers ──────────────────────────────────────────────────────

function pushNotification(notif: InstantOfferNotification): void {
  const existing = notificationStore.get(notif.npi) ?? [];
  existing.unshift(notif);
  // Cap at 50 per user
  notificationStore.set(notif.npi, existing.slice(0, 50));
  analytics.instantOffersSent++;
  logEvent('notification.sent', { npi: notif.npi, type: notif.type, channel: notif.channel });
}

// ── Holder growth loop triggers ───────────────────────────────────────────────

export function triggerInstantOfferNotification(params: {
  npi: string;
  opportunityId: string;
  employerSlug: string;
  opportunityTitle: string;
  channel?: NotificationChannel;
}): InstantOfferNotification {
  const notif: InstantOfferNotification = {
    notificationId: randomUUID(),
    npi: params.npi,
    type: 'INSTANT_OFFER',
    channel: params.channel ?? 'in_app',
    title: '⚡ Instant Offer Available',
    body: `You've been selected for "${params.opportunityTitle}". You're pre-cleared — accept to get started immediately.`,
    opportunityId: params.opportunityId,
    employerSlug: params.employerSlug,
    actionUrl: `/opportunities/${params.opportunityId}`,
    sentAt: new Date().toISOString(),
  };
  pushNotification(notif);
  return notif;
}

export function triggerClearToStartNotification(params: {
  npi: string;
  opportunityTitle: string;
  opportunityId: string;
}): InstantOfferNotification {
  const notif: InstantOfferNotification = {
    notificationId: randomUUID(),
    npi: params.npi,
    type: 'CLEAR_TO_START',
    channel: 'in_app',
    title: '✅ You are now clear for a role',
    body: `Your credentials are now verified for "${params.opportunityTitle}". Apply with one click.`,
    opportunityId: params.opportunityId,
    actionUrl: `/opportunities/${params.opportunityId}`,
    sentAt: new Date().toISOString(),
  };
  pushNotification(notif);
  return notif;
}

export function triggerOnboardingReminder(params: {
  npi: string;
  nextStep: string;
  stepsComplete: number;
  totalSteps: number;
}): InstantOfferNotification {
  const notif: InstantOfferNotification = {
    notificationId: randomUUID(),
    npi: params.npi,
    type: 'ONBOARDING_REMINDER',
    channel: 'in_app',
    title: `Complete your profile (${params.stepsComplete}/${params.totalSteps})`,
    body: `Next: ${params.nextStep}. Completing your profile unlocks instant offer eligibility.`,
    actionUrl: '/get-ready',
    sentAt: new Date().toISOString(),
  };
  pushNotification(notif);
  return notif;
}

export function triggerEligibleEmployerNotification(params: {
  npi: string;
  employerName: string;
  employerSlug: string;
}): InstantOfferNotification {
  const notif: InstantOfferNotification = {
    notificationId: randomUUID(),
    npi: params.npi,
    type: 'NEW_ELIGIBLE_EMPLOYER',
    channel: 'in_app',
    title: `🏥 New employer match: ${params.employerName}`,
    body: `Your credentials now meet ${params.employerName}'s requirements. Check open roles.`,
    employerSlug: params.employerSlug,
    actionUrl: `/employers/${params.employerSlug}`,
    sentAt: new Date().toISOString(),
  };
  pushNotification(notif);
  return notif;
}

// ── Growth loop event recording ───────────────────────────────────────────────

export function recordShareEvent(npi: string): void {
  analytics.holderShareEvents++;
  appendLifecycle(npi, 'PASSPORT_SHARE', 'Shared clinical passport', '/holder/share');
}

export function recordAssessmentCompletion(npi: string, moduleId: string): void {
  analytics.assessmentsCompleted++;
  appendLifecycle(npi, 'ASSESSMENT_COMPLETE', `Completed assessment: ${moduleId}`, '/holder/opportunities');
}

export function recordVerifierPost(orgId: string): void {
  analytics.verifierPostsPublished++;
  logEvent('verifier.opportunity_posted', { orgId });
}

export function markNotificationRead(npi: string, notificationId: string): boolean {
  const notifications = notificationStore.get(npi) ?? [];
  const n = notifications.find(n => n.notificationId === notificationId);
  if (!n) return false;
  n.readAt = new Date().toISOString();
  analytics.instantOffersOpened++;
  return true;
}

export function markNotificationActed(npi: string, notificationId: string): boolean {
  const notifications = notificationStore.get(npi) ?? [];
  const n = notifications.find(n => n.notificationId === notificationId);
  if (!n) return false;
  n.actedAt = new Date().toISOString();
  analytics.instantOffersAccepted++;
  return true;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export function getNotificationsForNpi(npi: string): InstantOfferNotification[] {
  return notificationStore.get(npi) ?? [];
}

export function getLifecycleEvents(npi: string): LifecycleEvent[] {
  return lifecycleStore.get(npi) ?? [];
}

export function getGrowthAnalytics(): GrowthAnalytics & { generatedAt: string } {
  return { ...analytics, generatedAt: new Date().toISOString() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function appendLifecycle(npi: string, trigger: string, message: string, actionUrl: string): void {
  const existing = lifecycleStore.get(npi) ?? [];
  existing.unshift({
    eventId: randomUUID(),
    npi,
    trigger,
    message,
    actionUrl,
    ts: new Date().toISOString(),
  });
  lifecycleStore.set(npi, existing.slice(0, 100));
}

function logEvent(event: string, meta: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...meta, ts: new Date().toISOString() }));
}
