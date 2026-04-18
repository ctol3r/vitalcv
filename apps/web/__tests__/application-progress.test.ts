import { describe, expect, it } from 'vitest';
import {
  resolveApplicationProgress,
  resolveEmployerApplicationContext,
} from '@/lib/apply/application-progress';
import { ACTION_OWNER } from '@/lib/trust/action-owner';
import type { ApplicationStatus } from '@/lib/apply/application-snapshot';

const ALL_STATUSES: ApplicationStatus[] = [
  'draft',
  'submitted',
  'viewed',
  'in_review',
  'waiting_on_refresh',
  'waiting_on_manual_review',
  'advanced',
  'credentialing',
  'approved',
  'start_ready',
  'started',
];

describe('resolveApplicationProgress', () => {
  it('produces a non-empty copy block for every status', () => {
    for (const status of ALL_STATUSES) {
      const copy = resolveApplicationProgress(status);
      expect(copy.label.trim().length).toBeGreaterThan(0);
      expect(copy.description.trim().length).toBeGreaterThan(0);
      expect(copy.clinicianNextStep.trim().length).toBeGreaterThan(0);
    }
  });

  it('assigns VitalCV ownership to refresh-waiting state (never the clinician)', () => {
    const waiting = resolveApplicationProgress('waiting_on_refresh');
    expect(waiting.nextOwner).toBe(ACTION_OWNER.VITALCV);
    expect(waiting.clinicianCanAct).toBe(false);
  });

  it('assigns Reviewer ownership to manual-review wait (never the clinician)', () => {
    const waiting = resolveApplicationProgress('waiting_on_manual_review');
    expect(waiting.nextOwner).toBe(ACTION_OWNER.REVIEWER);
    expect(waiting.clinicianCanAct).toBe(false);
  });

  it('assigns Employer ownership to submitted / viewed / in_review', () => {
    for (const status of ['submitted', 'viewed', 'in_review'] as ApplicationStatus[]) {
      expect(resolveApplicationProgress(status).nextOwner).toBe(ACTION_OWNER.EMPLOYER);
    }
  });

  it('allows clinician action only on draft and start_ready', () => {
    for (const status of ALL_STATUSES) {
      const copy = resolveApplicationProgress(status);
      if (status === 'draft' || status === 'start_ready') {
        expect(copy.clinicianCanAct).toBe(true);
      } else {
        expect(copy.clinicianCanAct).toBe(false);
      }
    }
  });

  it('marks only `started` as terminal', () => {
    for (const status of ALL_STATUSES) {
      const copy = resolveApplicationProgress(status);
      expect(copy.terminal).toBe(status === 'started');
    }
  });

  it('never frames waiting states as clinician defect in the copy', () => {
    const waitingRefresh = resolveApplicationProgress('waiting_on_refresh');
    const waitingReview = resolveApplicationProgress('waiting_on_manual_review');
    // Clinician next step must name VitalCV / reviewer as the actor, not the clinician.
    expect(waitingRefresh.clinicianNextStep.toLowerCase()).toContain('vitalcv');
    expect(waitingReview.clinicianNextStep.toLowerCase()).toContain('reviewer');
    // Must not say "your action" or "you need to" as a defect framing.
    expect(waitingRefresh.clinicianNextStep.toLowerCase()).not.toMatch(/you need to/);
    expect(waitingReview.clinicianNextStep.toLowerCase()).not.toMatch(/you need to/);
  });

  it('never promises a partial application will become decision-grade automatically', () => {
    for (const status of ALL_STATUSES) {
      const copy = resolveApplicationProgress(status);
      const combined = `${copy.description} ${copy.clinicianNextStep}`.toLowerCase();
      expect(combined).not.toMatch(/automatically upgrad/);
      expect(combined).not.toMatch(/will become decision-grade/);
    }
  });
});

describe('resolveEmployerApplicationContext', () => {
  it('produces a context headline and next step for every status', () => {
    for (const status of ALL_STATUSES) {
      const context = resolveEmployerApplicationContext(status);
      expect(context.contextHeadline.trim().length).toBeGreaterThan(0);
      expect(context.employerNextStep.trim().length).toBeGreaterThan(0);
    }
  });

  it('submitted context explicitly tells the employer the snapshot is frozen at submit time', () => {
    const context = resolveEmployerApplicationContext('submitted');
    expect(context.contextHeadline.toLowerCase()).toMatch(/frozen|submit time/);
  });

  it('waiting_on_refresh context warns that a new snapshot is pending', () => {
    const context = resolveEmployerApplicationContext('waiting_on_refresh');
    expect(context.contextHeadline.toLowerCase()).toMatch(/refresh|new snapshot/);
  });

  it('draft context disables employer action (no application exists yet)', () => {
    const context = resolveEmployerApplicationContext('draft');
    expect(context.employerNextStep.toLowerCase()).toMatch(/no action|not been submitted/);
  });
});
