/**
 * Wave Q — durable commercial lead capture.
 *
 * - persistPilotLead writes the lead row + its AuditEvent in ONE transaction
 *   (audit-first) and degrades to persisted:false, never a throw.
 * - /api/pilot-intake persists FIRST, then delivers to Slack (a crash can no
 *   longer lose the lead), and keeps its existing validation contract.
 * - /api/pilot-request persists the structured record (the previously
 *   deferred wiring) without changing the buyer-facing confirmation.
 * - The concierge offer stays honest: readiness packet wording, no payment
 *   collected, employer still decides.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { pilotLeadCreate, pilotLeadUpdate, auditEventCreate, transactionMock, slackMock } = vi.hoisted(() => ({
  pilotLeadCreate: vi.fn(),
  pilotLeadUpdate: vi.fn(),
  auditEventCreate: vi.fn(),
  transactionMock: vi.fn(),
  slackMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    pilotLead: { create: pilotLeadCreate, update: pilotLeadUpdate },
    auditEvent: { create: auditEventCreate },
    $transaction: transactionMock,
  },
}));

vi.mock('@/lib/pilot-intake/slack', () => ({
  deliverPilotIntakeToSlack: slackMock,
}));

import { persistPilotLead } from '../lib/leads/pilotLeadPersistence';
import { validatePilotIntake } from '../lib/pilot-intake/validate';
import ConciergePage from '../app/concierge/page';

const VALID_INTAKE = {
  fullName: 'Dana Buyer',
  email: 'dana@mercy.example',
  organization: 'Mercy General',
  persona: 'health_system',
  description: 'We want to pilot readiness packets for our locum intake.',
};

beforeEach(() => {
  pilotLeadCreate.mockReset().mockImplementation((args) => ({ __op: 'lead', args }));
  pilotLeadUpdate.mockReset().mockResolvedValue({});
  auditEventCreate.mockReset().mockImplementation((args) => ({ __op: 'audit', args }));
  transactionMock.mockReset().mockResolvedValue([{}, {}]);
  slackMock.mockReset().mockResolvedValue({ delivered: false, reason: 'unconfigured' });
});

describe('persistPilotLead', () => {
  it('writes the lead and its audit event in one transaction', async () => {
    const result = await persistPilotLead({
      source: 'pilot_intake',
      persona: 'concierge',
      organization: 'Mercy General',
      contactName: 'Dana Buyer',
      email: 'dana@mercy.example',
      message: 'Requesting the readiness packet.',
      sourceContext: '/contact',
      payload: { anything: true },
    });

    expect(result.persisted).toBe(true);
    expect(result.leadId).toMatch(/^[0-9a-f-]{36}$/);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2);

    const lead = pilotLeadCreate.mock.calls[0][0].data;
    expect(lead).toMatchObject({
      id: result.leadId,
      source: 'pilot_intake',
      persona: 'concierge',
      organization: 'Mercy General',
      email: 'dana@mercy.example',
      slackDelivered: false,
    });

    const audit = auditEventCreate.mock.calls[0][0].data;
    expect(audit.type).toBe('pilot.lead_captured');
    expect(audit.referenceId).toBe(result.leadId);
    expect(audit.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(audit.metadata).toMatchObject({ source: 'pilot_intake', organization: 'Mercy General' });
  });

  it('degrades to persisted:false when the table is not deployed yet', async () => {
    transactionMock.mockRejectedValue(new Error('P2021: table does not exist'));
    const result = await persistPilotLead({
      source: 'pilot_request',
      organization: 'Mercy General',
      email: 'dana@mercy.example',
      payload: {},
    });
    expect(result).toEqual({ persisted: false, leadId: null });
  });
});

describe('POST /api/pilot-intake', () => {
  async function post(body: unknown) {
    const { POST } = await import(new URL('../app/api/pilot-intake/route.ts', import.meta.url).href);
    return POST(new Request('http://localhost/api/pilot-intake', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  it('persists the lead before Slack and reports both statuses', async () => {
    slackMock.mockResolvedValue({ delivered: true });

    const res = await post(VALID_INTAKE);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      persisted: true,
      slackDelivered: true,
    });
    expect(pilotLeadCreate.mock.calls[0][0].data).toMatchObject({
      source: 'pilot_intake',
      organization: 'Mercy General',
      contactName: 'Dana Buyer',
      persona: 'health_system',
    });
    // Delivery succeeded → operational flag corrected after the durable write.
    expect(pilotLeadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { slackDelivered: true } }),
    );
    // Persist happened even though it ran before Slack.
    expect(transactionMock.mock.invocationCallOrder[0]).toBeLessThan(
      slackMock.mock.invocationCallOrder[0],
    );
  });

  it('keeps the lead durable when Slack fails', async () => {
    slackMock.mockResolvedValue({ delivered: false, reason: 'http_error' });

    const res = await post(VALID_INTAKE);

    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      persisted: true,
      slackDelivered: false,
    });
    expect(pilotLeadUpdate).not.toHaveBeenCalled();
  });

  it('rejects invalid submissions without touching the DB', async () => {
    const res = await post({ ...VALID_INTAKE, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(slackMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/pilot-request', () => {
  it('persists the structured record as a pilot_request lead', async () => {
    const { POST } = await import(new URL('../app/api/pilot-request/route.ts', import.meta.url).href);
    const res = await POST(new Request('http://localhost/api/pilot-request', {
      method: 'POST',
      body: JSON.stringify({
        organization: 'Mercy General',
        name: 'Dana Buyer',
        email: 'dana@mercy.example',
        usecase: 'Credentialing review',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.ok).toBe(true);
    expect(payload.persisted).toBe(true);
    expect(payload.record.orgName).toBe('Mercy General');

    const lead = pilotLeadCreate.mock.calls[0][0].data;
    expect(lead).toMatchObject({
      source: 'pilot_request',
      organization: 'Mercy General',
      email: 'dana@mercy.example',
      workflowTarget: 'Credentialing review',
    });
    expect(lead.payload.pilotId).toBeTruthy();
  });
});

describe('concierge persona + offer page honesty', () => {
  it("accepts 'concierge' as an intake persona", () => {
    const result = validatePilotIntake({ ...VALID_INTAKE, persona: 'concierge' });
    expect(result.ok).toBe(true);
  });

  it('renders the honest concierge offer: readiness packet, no payment, routed to contact', () => {
    const markup = renderToStaticMarkup(<ConciergePage />);
    expect(markup).toContain('credential readiness packet');
    expect(markup).toContain('/contact?persona=concierge');
    expect(markup).toContain('no payment is collected on');
    expect(markup).toContain('always make their own acceptance decisions');
  });

  it('keeps banned claims out of the concierge copy', () => {
    const source = readFileSync(join(__dirname, '../app/concierge/page.tsx'), 'utf8');
    expect(source).not.toMatch(
      /automatically verified|guaranteed verification|complete credentialing|instant credentialing|certified compliant/i,
    );
    expect(source).not.toMatch(/label:\s*['"]Verified['"]/);
  });
});
