/**
 * Pilot confirmation copy contract.
 *
 * When a buyer submits the paid-pilot request form, the response
 * page must answer four questions explicitly — without vague
 * "we'll be in touch" language:
 *   1. What happens next?
 *   2. What will VitalCV measure?
 *   3. What does the buyer need to provide?
 *   4. What remains outside current coverage?
 *
 * This module carries that copy as structured data so the confirmation
 * page and the structured API response stay in lockstep. Mirrors the
 * buyer-pilot-copy contract from Wave 244 but scoped to the
 * post-submission flow.
 */

import type { PilotRequestRecord } from './pilot-intake';

export interface PilotConfirmationBullets {
  whatHappensNext: string[];
  whatVitalCvMeasures: string[];
  whatYouProvide: string[];
  outsideCoverage: string[];
}

export const PILOT_CONFIRMATION_BULLETS: PilotConfirmationBullets = {
  whatHappensNext: [
    'A VitalCV operator reviews your submission within two business days.',
    'If scope is a fit, the operator schedules a scoping call to confirm NPIs, lanes, measurement window, and success criteria.',
    'You receive a signed scope document before any measurement starts. No auto-provisioning.',
  ],
  whatVitalCvMeasures: [
    'Startability timeline events across every application submitted during the window (submit, first view, first action, advanced, start-ready, started).',
    'Median time deltas against your baseline numbers — never against a generic industry figure.',
    'Refresh and missing-info request counts, with owner attribution on every request.',
    'Proof-tier distribution at submit time (decision-grade vs partial vs draft).',
  ],
  whatYouProvide: [
    'A list of real clinician NPIs for the measurement window.',
    'A named review operator who will run decisions on the pilot applications.',
    'Your current baseline numbers (time-to-start days, applications per month) — or an honest "we don\u2019t track this yet" so we can capture it from scratch.',
    'Access to your review decision workflow (employer context, user identity).',
  ],
  outsideCoverage: [
    'NPDB, DEA registration, ABMS board certification, CAQH, and SAM.gov — these remain your credentialing office\u2019s scope.',
    'Per-state board coverage for states outside the configured pilot lanes. Nursys / FSMB activation requires institutional agreements your organization signs directly.',
    'Final privileging decisions. VitalCV provides the pre-screen; your credentialing committee still owns the approval.',
  ],
};

export interface PilotConfirmationRenderModel {
  /** Short confirmation headline — "Request received". */
  headline: string;
  /** One-line acknowledgement with the buyer's org name + next-step window. */
  acknowledgement: string;
  bullets: PilotConfirmationBullets;
  /** Operator-facing handoff summary. Shown to the buyer as a soft
   *  reassurance that a human is on it, and shown to the operator in
   *  the ops handoff surface as the record-level summary. */
  operatorHandoff: {
    owner: string;
    ownerLabel: string;
    nextStep: string;
    ownerInboxLine: string;
  };
  /** Reference lines — pilotId, submissionHash — rendered in a small
   *  monospace footer so the buyer can cite the request ID if they
   *  follow up. */
  reference: {
    pilotId: string;
    submissionHash: string;
    requestedAt: string;
  };
}

const OWNER_LABELS: Record<PilotRequestRecord['owner'], string> = {
  pilot_ops: 'VitalCV Pilot Ops',
  customer_success: 'VitalCV Customer Success',
  solutions_engineer: 'VitalCV Solutions Engineer',
  founder: 'VitalCV Founder',
};

const OWNER_INBOX_LINES: Record<PilotRequestRecord['owner'], string> = {
  pilot_ops:
    'Pilot Ops reviews new requests daily. Expect a scoping reply within two business days.',
  customer_success:
    'Customer Success holds active-pilot check-ins weekly. Expect a check-in invitation shortly.',
  solutions_engineer:
    'A Solutions Engineer handles scoping and baseline capture. Expect a scoping-call invitation within two business days.',
  founder:
    'The founder is handling this personally. Expect a direct reply.',
};

export function buildPilotConfirmationRenderModel(
  record: PilotRequestRecord,
): PilotConfirmationRenderModel {
  const ownerLabel = OWNER_LABELS[record.owner];
  const ownerInboxLine = OWNER_INBOX_LINES[record.owner];
  return {
    headline: 'Pilot request received',
    acknowledgement: `Thanks — we have your request from ${record.orgName}. ${ownerInboxLine}`,
    bullets: PILOT_CONFIRMATION_BULLETS,
    operatorHandoff: {
      owner: record.owner,
      ownerLabel,
      nextStep: record.nextStep,
      ownerInboxLine,
    },
    reference: {
      pilotId: record.pilotId,
      submissionHash: record.submissionHash,
      requestedAt: record.requestedAt,
    },
  };
}
