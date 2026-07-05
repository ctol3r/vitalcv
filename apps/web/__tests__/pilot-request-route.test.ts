import { describe, expect, it, vi } from 'vitest';

// The route now imports the lead-persistence lib (server-only + prisma).
// Without a DB in the test env the write degrades to persisted:false, which
// is exactly the deploy-order-safe contract.
vi.mock('server-only', () => ({}));
import { POST } from '@/app/api/pilot-request/route';

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/pilot-request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>): Request {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) params.append(k, v);
  return new Request('http://localhost/api/pilot-request', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

describe('/api/pilot-request POST — structured intake', () => {
  it('returns a structured record + confirmation for a valid JSON submission', async () => {
    const res = await POST(
      jsonRequest({
        organization: 'Acme Health',
        name: 'Jane Smith',
        email: 'jane@acme.health',
        usecase: 'Locum placement for ER coverage',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      record: {
        pilotId: string;
        owner: string;
        status: string;
        nextStep: string;
        orgName: string;
        roleOrWorkflowTarget: string;
        successCriteria: Array<{ kind: string }>;
        baselineMetrics: Array<{ value: number | null }>;
      };
      confirmation: { acknowledgement: string; bullets: { whatHappensNext: string[] } };
    };
    expect(body.ok).toBe(true);
    expect(body.record.owner).toBe('pilot_ops');
    expect(body.record.status).toBe('requested');
    expect(body.record.orgName).toBe('Acme Health');
    expect(body.record.roleOrWorkflowTarget).toBe('Locum placement for ER coverage');
    expect(body.record.nextStep.trim().length).toBeGreaterThan(0);
    expect(body.record.successCriteria.length).toBeGreaterThan(0);
    expect(body.record.baselineMetrics.every((m) => m.value === null)).toBe(true);
    expect(body.confirmation.bullets.whatHappensNext.length).toBeGreaterThan(0);
  });

  it('accepts the HTML form encoding used by /pilot page fallback', async () => {
    const res = await POST(
      formRequest({
        organization: 'Form Corp',
        name: 'Sam Buyer',
        email: 'sam@formcorp.health',
        usecase: 'Credentialing committee pre-screen',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; record: { orgName: string } };
    expect(body.ok).toBe(true);
    expect(body.record.orgName).toBe('Form Corp');
  });

  it('returns 400 with structured errors on missing fields', async () => {
    const res = await POST(jsonRequest({ organization: '', name: '', email: '' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      ok: boolean;
      errors: Array<{ field: string; reason: string }>;
    };
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBe(3);
    expect(body.errors.map((e) => e.field).sort()).toEqual([
      'contactEmail',
      'contactName',
      'orgName',
    ]);
  });

  it('returns 400 with a specific email error on malformed address', async () => {
    const res = await POST(
      jsonRequest({
        organization: 'x',
        name: 'y',
        email: 'not-an-email',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      errors: Array<{ field: string; reason: string }>;
    };
    expect(body.errors[0].field).toBe('contactEmail');
  });

  it('confirmation acknowledgement names the org and the owner inbox line', async () => {
    const res = await POST(
      jsonRequest({
        organization: 'Named Health System',
        name: 'Jane',
        email: 'jane@named.health',
      }),
    );
    const body = (await res.json()) as {
      confirmation: { acknowledgement: string };
    };
    expect(body.confirmation.acknowledgement).toContain('Named Health System');
    // Owner-inbox line for pilot_ops must mention "two business days".
    expect(body.confirmation.acknowledgement.toLowerCase()).toContain('two business days');
  });

  it('structured record carries an audit entry attributing the buyer', async () => {
    const res = await POST(
      jsonRequest({ organization: 'x', name: 'y', email: 'z@z.com' }),
    );
    const body = (await res.json()) as {
      record: {
        auditLog: Array<{ actor: string; action: string; to: string | undefined }>;
      };
    };
    expect(body.record.auditLog).toHaveLength(1);
    expect(body.record.auditLog[0].actor).toBe('buyer');
    expect(body.record.auditLog[0].action).toBe('requested');
    expect(body.record.auditLog[0].to).toBe('requested');
  });

  it('invalid JSON body + missing fields still returns 400 (does not throw)', async () => {
    const brokenJson = new Request('http://localhost/api/pilot-request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not{json[',
    });
    const res = await POST(brokenJson);
    expect(res.status).toBe(400);
  });
});
