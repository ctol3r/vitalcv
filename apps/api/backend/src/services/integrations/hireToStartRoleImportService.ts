/**
 * Authenticated generic role import for design partners.
 *
 * Organization scope comes from the verified caller's server-held User row.
 * The payload cannot name an organization. Imported roles remain ordinary
 * employer-posted opportunities; no vendor-specific adapter is introduced.
 */
import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import { sha256ForPayload } from '../../utils/deterministic';

const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface GenericRoleImportInput {
  sourceSystem: string;
  roles: Array<{
    externalRoleId: string;
    title: string;
    specialty: string;
    hiringType: string;
    state: string;
    description?: string | null;
    remote?: boolean;
    status?: 'ACTIVE' | 'CLOSED';
    sourceUrl?: string | null;
  }>;
}

function bounded(value: unknown, field: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new HttpError(400, `${field} is required and must be at most ${max} characters.`);
  return text;
}

function token(value: unknown, field: string): string {
  const text = bounded(value, field, 128);
  if (!TOKEN_RE.test(text)) throw new HttpError(400, `${field} contains unsupported characters.`);
  return text;
}

function sourceUrl(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  const text = bounded(value, field, 1_000);
  let parsed: URL;
  try { parsed = new URL(text); } catch { throw new HttpError(400, `${field} must be a valid HTTPS URL.`); }
  if (parsed.protocol !== 'https:') throw new HttpError(400, `${field} must be a valid HTTPS URL.`);
  return parsed.toString();
}

function parse(input: GenericRoleImportInput): GenericRoleImportInput {
  const sourceSystem = token(input?.sourceSystem, 'sourceSystem');
  if (!Array.isArray(input?.roles) || input.roles.length === 0 || input.roles.length > 100) {
    throw new HttpError(400, 'roles must contain between 1 and 100 records.');
  }
  return {
    sourceSystem,
    roles: input.roles.map((role, index) => ({
      externalRoleId: token(role?.externalRoleId, `roles[${index}].externalRoleId`),
      title: bounded(role?.title, `roles[${index}].title`, 200),
      specialty: bounded(role?.specialty, `roles[${index}].specialty`, 200),
      hiringType: bounded(role?.hiringType, `roles[${index}].hiringType`, 80),
      state: bounded(role?.state, `roles[${index}].state`, 80),
      description: role?.description == null ? null : bounded(role.description, `roles[${index}].description`, 5_000),
      remote: Boolean(role?.remote),
      status: role?.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
      sourceUrl: sourceUrl(role?.sourceUrl, `roles[${index}].sourceUrl`),
    })),
  };
}

export async function importGenericHireToStartRoles(
  clerkUserId: string,
  raw: GenericRoleImportInput,
  now = new Date(),
): Promise<{ organizationId: string; created: number; updated: number; opportunityIds: string[] }> {
  const input = parse(raw);
  const user = await prisma.user.findUnique({ where: { clerkUserId }, select: { organizationId: true } });
  if (!user?.organizationId) throw new HttpError(404, 'Organization role import is unavailable.');
  const organizationId = user.organizationId;

  return prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    const opportunityIds: string[] = [];
    for (const role of input.roles) {
      const sourceFeed = 'employer_integration';
      const sourceRef = `${organizationId}:${input.sourceSystem}:${role.externalRoleId}`;
      const existing = await tx.opportunity.findUnique({
        where: { sourceFeed_sourceRef: { sourceFeed, sourceRef } },
        select: { id: true, organizationId: true },
      });
      if (existing && existing.organizationId !== organizationId) {
        throw new HttpError(409, 'An imported role reference is already bound to another organization.');
      }
      const data = {
        title: role.title,
        specialty: role.specialty,
        hiringType: role.hiringType,
        state: role.state,
        description: role.description ?? null,
        remote: Boolean(role.remote),
        status: role.status ?? 'ACTIVE',
        listingSource: 'employer_posted',
        sourceFeed,
        sourceRef,
        sourceUrl: role.sourceUrl ?? null,
        fetchedAt: now,
      };
      const opportunity = existing
        ? await tx.opportunity.update({ where: { id: existing.id }, data })
        : await tx.opportunity.create({ data: { ...data, organizationId } });
      if (existing) updated += 1;
      else created += 1;
      opportunityIds.push(opportunity.id);
      await tx.auditEvent.create({
        data: {
          type: 'INTEGRATION_ROLE_IMPORTED',
          hash: sha256ForPayload({ organizationId, sourceSystem: input.sourceSystem, role, opportunityId: opportunity.id }),
          referenceId: opportunity.id,
          clinicianId: clerkUserId,
          organizationId,
          metadata: {
            sourceSystem: input.sourceSystem,
            externalRoleId: role.externalRoleId,
            action: existing ? 'updated' : 'created',
            vendorSpecificAdapter: false,
          },
        },
      });
    }
    return { organizationId, created, updated, opportunityIds };
  });
}
