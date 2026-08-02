import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { createHash } from 'node:crypto';
import {
  resolveOrganizationAuthority,
  describeOrganizationAuthorityRefusal,
  type OrganizationAuthorityReason,
} from './employerIntegrity';

/**
 * Organization access governance — the durable half of the authority gate.
 *
 * `resolveOrganizationAuthority` answers a pure question: may this account be
 * granted administrative access to this organization without a human? That
 * answer had no consequences beyond a thrown 403. This module gives every
 * answer a record, an audit event, and an outbox event.
 *
 * ── Two invariants ──
 *
 * **Authority is decided server-side, from server-held facts.** The account
 * email comes from the `User` row keyed by the Clerk user id, never from the
 * request body. A caller cannot assert its own authority, its own email, its
 * own status, or its own organization id. The only caller-supplied input the
 * decision reads is the organization's website — which is exactly why the
 * second invariant exists.
 *
 * **A domain match never binds an NPI.** The website arrives from the caller,
 * so a match proves the caller controls an email at a domain they themselves
 * supplied. That is a real signal about the domain and no signal at all about
 * a Type 2 NPI: anyone with a work address at `attacker.example` could send a
 * hospital's real NPI alongside their own domain and walk away with the
 * hospital's federal identifier bound to their organization. So an automatic
 * grant creates the organization WITHOUT its NPI and records
 * `npiBindingGranted: false`; binding is a separate, reviewed decision.
 * NPPES identity is what an NPI is for — it is never organization authority.
 */

export type OrganizationAccessStatus = 'PENDING_REVIEW' | 'GRANTED' | 'DENIED';

export interface OrganizationAccessDecision {
  /** Whether access may be granted with no human in the loop. */
  authorized: boolean;
  /** Discriminant explaining the decision — recorded verbatim. */
  reason: OrganizationAuthorityReason;
  status: OrganizationAccessStatus;
  /** Always false on an automatic grant. See the module note. */
  npiBindingGranted: boolean;
  emailDomain: string | null;
  /** Honest, non-leaky sentence for a refused caller. Null when authorized. */
  refusal: string | null;
  /** Id of the durable OrganizationAccessRequest row. */
  requestId: string;
}

export interface OrganizationAccessRequestInput {
  clerkUserId: string;
  /** Server-held account email. NEVER read from the request body. */
  accountEmail: string | null | undefined;
  requestedName: string;
  requestedNpi?: string | null;
  requestedWebsite?: string | null;
  /** Domain derived server-side from the website by canonical identity. */
  organizationDomain: string | null | undefined;
}

function stableHash(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/**
 * Decide, record, and emit the consequences of an organization access request.
 *
 * Always writes a row: a refusal is a pending review item, not a dead end. The
 * caller applies the outcome (creating the organization only when authorized);
 * this function owns the decision and its paper trail.
 */
export async function recordOrganizationAccessRequest(
  input: OrganizationAccessRequestInput,
): Promise<OrganizationAccessDecision> {
  const authority = resolveOrganizationAuthority({
    accountEmail: input.accountEmail,
    organizationDomain: input.organizationDomain,
  });

  const status: OrganizationAccessStatus = authority.authorized ? 'GRANTED' : 'PENDING_REVIEW';

  const request = await prisma.organizationAccessRequest.create({
    data: {
      clerkUserId: input.clerkUserId,
      accountEmail: input.accountEmail ?? null,
      requestedName: input.requestedName,
      requestedNpi: input.requestedNpi?.trim() || null,
      requestedWebsite: input.requestedWebsite?.trim() || null,
      requestedDomain: input.organizationDomain ?? null,
      status,
      authorityReason: authority.reason,
      emailDomain: authority.emailDomain,
      // Invariant: never true on an automatic grant.
      npiBindingGranted: false,
    },
    select: { id: true },
  });

  await emitAccessConsequences({
    requestId: request.id,
    clerkUserId: input.clerkUserId,
    status,
    reason: authority.reason,
    requestedName: input.requestedName,
    requestedNpi: input.requestedNpi?.trim() || null,
    requestedDomain: input.organizationDomain ?? null,
    emailDomain: authority.emailDomain,
  });

  return {
    authorized: authority.authorized,
    reason: authority.reason,
    status,
    npiBindingGranted: false,
    emailDomain: authority.emailDomain,
    refusal: authority.authorized ? null : describeOrganizationAuthorityRefusal(authority.reason),
    requestId: request.id,
  };
}

/** Attach the organization to a granted request, once it actually exists. */
export async function attachOrganizationToAccessRequest(
  requestId: string,
  organizationId: string,
): Promise<void> {
  await prisma.organizationAccessRequest.update({
    where: { id: requestId },
    data: { organizationId },
  });
}

interface AccessConsequenceInput {
  requestId: string;
  clerkUserId: string;
  status: OrganizationAccessStatus;
  reason: OrganizationAuthorityReason;
  requestedName: string;
  requestedNpi: string | null;
  requestedDomain: string | null;
  emailDomain: string | null;
}

/**
 * Audit + outbox for one access decision.
 *
 * Both are written for refusals too. A refused attempt to take over an
 * organization is precisely the event worth having a record of, and the
 * previous code kept none.
 */
async function emitAccessConsequences(input: AccessConsequenceInput): Promise<void> {
  const eventType =
    input.status === 'GRANTED' ? 'ORGANIZATION_ACCESS_GRANTED' : 'ORGANIZATION_ACCESS_PENDING_REVIEW';

  const payload = {
    requestId: input.requestId,
    clerkUserId: input.clerkUserId,
    status: input.status,
    authorityReason: input.reason,
    requestedName: input.requestedName,
    requestedNpi: input.requestedNpi,
    requestedDomain: input.requestedDomain,
    emailDomain: input.emailDomain,
    // Stated in the payload so a downstream consumer cannot infer that a grant
    // carried the NPI with it.
    npiBindingGranted: false,
  };

  await prisma.auditEvent.create({
    data: {
      type: eventType,
      hash: stableHash(payload),
      referenceId: input.requestId,
      metadata: payload as Prisma.InputJsonValue,
    },
  });

  await prisma.outboxEvent.upsert({
    where: { dedupeKey: `${eventType}:${input.requestId}` },
    create: {
      eventType,
      aggregateType: 'ORGANIZATION_ACCESS_REQUEST',
      aggregateId: input.requestId,
      payload: payload as Prisma.InputJsonValue,
      dedupeKey: `${eventType}:${input.requestId}`,
      status: 'PENDING',
      attemptCount: 0,
    },
    update: { payload: payload as Prisma.InputJsonValue },
    select: { id: true },
  });
}
