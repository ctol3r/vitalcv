import 'server-only';

/**
 * pilotLeadPersistence — Wave Q. Durable capture of commercial leads.
 *
 * Writes one PilotLead row plus its AuditEvent ('pilot.lead_captured') in a
 * single transaction (audit-first rule). Deploy-order safe: if the table is
 * not deployed yet or the DB hiccups, returns { persisted: false } and never
 * throws — lead capture must keep working on Slack/stdout alone.
 *
 * Leads are operational CRM data, never evidence: no clinician credentials,
 * no verification state, no trust-state inputs.
 */
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';

export interface PilotLeadInput {
  source: 'pilot_request' | 'pilot_intake';
  persona?: string | null;
  organization: string;
  contactName?: string | null;
  email: string;
  message?: string | null;
  workflowTarget?: string | null;
  sourceContext?: string | null;
  /** Full sanitized submission / structured record for follow-up context. */
  payload: unknown;
  slackDelivered?: boolean;
}

export interface PilotLeadResult {
  persisted: boolean;
  leadId: string | null;
}

const clamp = (value: string | null | undefined, max: number): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

export async function persistPilotLead(input: PilotLeadInput): Promise<PilotLeadResult> {
  const leadId = randomUUID();
  const capturedAt = new Date().toISOString();
  const organization = clamp(input.organization, 200) ?? 'Unknown organization';
  const email = clamp(input.email, 320) ?? '';

  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        capturedAt,
        email,
        leadId,
        organization,
        source: input.source,
      }),
    )
    .digest('hex');

  try {
    await prisma.$transaction([
      prisma.pilotLead.create({
        data: {
          id: leadId,
          source: input.source,
          persona: clamp(input.persona, 80),
          organization,
          contactName: clamp(input.contactName, 200),
          email,
          message: clamp(input.message, 4000),
          workflowTarget: clamp(input.workflowTarget, 200),
          sourceContext: clamp(input.sourceContext, 200),
          payload: JSON.parse(JSON.stringify(input.payload ?? {})),
          slackDelivered: input.slackDelivered ?? false,
        },
      }),
      prisma.auditEvent.create({
        data: {
          id: randomUUID(),
          type: 'pilot.lead_captured',
          hash,
          referenceId: leadId,
          metadata: {
            capturedAt,
            leadId,
            organization,
            persona: clamp(input.persona, 80),
            source: input.source,
            sourceContext: clamp(input.sourceContext, 200),
          },
        },
      }),
    ]);
    return { persisted: true, leadId };
  } catch (err) {
    console.error('[pilotLeadPersistence]', err);
    // Slack/stdout remain the paper trail until the migration deploys.
    return { persisted: false, leadId: null };
  }
}

/** Best-effort operational-status update; the AuditEvent stays immutable. */
export async function markPilotLeadSlackDelivered(leadId: string): Promise<void> {
  try {
    await prisma.pilotLead.update({
      where: { id: leadId },
      data: { slackDelivered: true },
    });
  } catch {
    /* operational flag only — never surface an error for this */
  }
}
