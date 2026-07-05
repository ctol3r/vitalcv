/**
 * POST /api/pilot-request
 *
 * Turns a buyer-submitted pilot request into a structured
 * PilotRequestRecord with owner, next step, baseline skeleton, and
 * canonical success criteria. Accepts both JSON bodies (from the
 * hardened /pilot page fetch handler, future callers) and
 * application/x-www-form-urlencoded (from the current HTML form
 * fallback).
 *
 * Response on success (200):
 *   { ok: true, record: PilotRequestRecord, confirmation: PilotConfirmationRenderModel }
 *
 * Response on validation failure (400):
 *   { ok: false, errors: PilotIntakeInputError[] }
 *
 * Side effects stay deliberately small ("do not build a full CRM"):
 * the structured record is returned to the caller and one durable
 * PilotLead row + AuditEvent is written (Wave Q). Email notification
 * wiring remains deferred.
 */

import { NextResponse } from 'next/server';
import {
  createPilotRequestRecord,
  validatePilotIntakeInput,
  type PilotIntakeInput,
} from '@/lib/pilot/pilot-intake';
import { buildPilotConfirmationRenderModel } from '@/lib/pilot/pilot-confirmation-copy';
import { persistPilotLead } from '@/lib/leads/pilotLeadPersistence';

async function readRequestBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const parsed = (await request.json()) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  // Form-encoded fallback — the existing /pilot page HTML form submits
  // as application/x-www-form-urlencoded or multipart/form-data.
  const form = await request.formData();
  const record: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    record[key] = typeof value === 'string' ? value : value.name;
  }
  return record;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readRequestBody(request);

  const input: PilotIntakeInput = {
    orgName: readString(body, 'organization') || readString(body, 'orgName'),
    contactName: readString(body, 'name') || readString(body, 'contactName'),
    contactEmail: readString(body, 'email') || readString(body, 'contactEmail'),
    orgId: readString(body, 'orgId') || null,
    roleOrWorkflowTarget:
      readString(body, 'roleOrWorkflowTarget')
      || readString(body, 'usecase')
      || 'Credentialing review',
    sourceContext: readString(body, 'sourceContext') || '/pilot',
  };

  const errors = validatePilotIntakeInput(input);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        errors,
        message: errors
          .map((e) => e.reason)
          .join(' '),
      },
      { status: 400 },
    );
  }

  const record = createPilotRequestRecord(input);
  const confirmation = buildPilotConfirmationRenderModel(record);

  // Wave Q: the previously-deferred persistence. Durable PilotLead row +
  // AuditEvent in one transaction; degrades to persisted:false until the
  // migration deploys and never blocks the buyer's confirmation.
  const lead = await persistPilotLead({
    source: 'pilot_request',
    organization: record.orgName,
    contactName: record.contactName,
    email: record.contactEmail,
    workflowTarget: record.roleOrWorkflowTarget,
    sourceContext: record.sourceContext,
    payload: record,
  });

  return NextResponse.json(
    {
      ok: true,
      persisted: lead.persisted,
      record,
      confirmation,
      message: confirmation.acknowledgement,
    },
    { status: 200 },
  );
}
