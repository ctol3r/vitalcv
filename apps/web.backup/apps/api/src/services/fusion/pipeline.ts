import { PrismaClient, type Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import {
  anchorFusionRoot,
  type AnchorRecord,
} from '../audit/anchor';
import { detectFusionConflicts } from './conflicts';
import { buildFusionBundle } from './fhir-export';
import { evaluateCandidate, resolveFusionGroup } from './policy';
import { runFusionValidations } from './validation';
import type {
  FusedCredentialRecord,
  FusionCandidate,
  FusionComponent,
  FusionPipelineOptions,
  FusionPipelineResult,
  FusionSourceRef,
  FusionSourceSnapshot,
  FusionTimelineEvent,
} from './types';

const prisma = new PrismaClient();

export async function runCredentialFusion(
  clinicianId: string,
  options: FusionPipelineOptions = {},
): Promise<FusionPipelineResult> {
  if (!clinicianId) {
    throw new Error('clinicianId is required for credential fusion');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();

  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const sources = await loadSources(client, clinicianId, clinician.user?.id ?? null);
  const trustDirectory = await loadTrustDirectory(client);

  const policyContext = {
    now,
    trustDirectory,
    defaultTrust: 0.6,
  };

  const candidateGroups = buildCandidateGroups(sources, now);
  const fusedComponents: FusionComponent[] = [];
  const diffEntries: FusedCredentialRecord['diff'] = [];
  const resolutions: FusionPipelineResult['resolutions'] = [];

  for (const candidates of candidateGroups.values()) {
    if (!candidates.length) continue;
    const evaluations = candidates.map((candidate) => evaluateCandidate(candidate, policyContext));
    const decision = resolveFusionGroup(candidates, policyContext);

    const componentId = `${decision.selected.type}:${decision.selected.key}`;
    const sourceRefs: FusionSourceRef[] = evaluations.map((evaluation) => ({
      sourceId: evaluation.candidate.sourceId,
      type: evaluation.candidate.type,
      trust: evaluation.metrics.trust,
      updatedAt: evaluation.candidate.updatedAt,
      anchor: evaluation.candidate.anchor ?? null,
      issuer: evaluation.candidate.issuer ?? null,
      issuerDid: evaluation.candidate.issuerDid ?? null,
      summary: evaluation.candidate.payload,
    }));

    fusedComponents.push({
      id: componentId,
      type: decision.selected.type,
      key: decision.selected.key,
      label: decision.selected.label,
      status: decision.selected.status,
      fields: decision.selected.payload,
      chosenSourceId: decision.selected.sourceId,
      metrics: decision.metrics,
      sources: sourceRefs,
    });

    diffEntries.push({
      componentId,
      label: decision.selected.label,
      fused: decision.selected.payload,
      inputs: sourceRefs,
    });

    if (candidates.length > 1) {
      resolutions.push({
        conflictId: randomUUID(),
        selectedComponentId: componentId,
        policy: decision.policy,
        rationale: decision.rationale,
      });
    }
  }

  const timeline = buildTimeline(fusedComponents);
  const summary = buildSummary(sources, fusedComponents);
  const rootHash = computeRootHash(fusedComponents);

  const fused: FusedCredentialRecord = {
    clinicianId,
    generatedAt: now.toISOString(),
    summary,
    components: fusedComponents,
    timeline,
    diff: diffEntries,
    rootHash,
  };

  const conflicts = detectFusionConflicts(sources, {
    clinicianName: clinician.user?.name ?? clinician.displayName ?? undefined,
    clinicianSpecialty: clinician.specialty ?? undefined,
    now,
  });
  const validations = runFusionValidations({ fused, sources, now });

  let anchor: AnchorRecord | undefined;
  if (!options.skipAnchor) {
    anchor = anchorFusionRoot({
      clinicianId,
      rootHash,
      componentCount: fused.components.length,
      conflictCount: conflicts.length,
      validationErrors: validations.filter((finding) => finding.level === 'error').length,
    });
  }

  if (options.persist !== false) {
    await persistFusionSnapshot(client, clinicianId, sources, fused);
  }

  const response: FusionPipelineResult = {
    clinicianId,
    generatedAt: fused.generatedAt,
    sources,
    fused,
    conflicts,
    resolutions,
    validations,
    anchor,
  };

  if (options.includeBundle) {
    response.fhirBundle = buildFusionBundle(response);
  }

  return response;
}

export async function getCredentialFusionSnapshot(
  clinicianId: string,
  options: { prisma?: PrismaClient } = {},
) {
  const client = options.prisma ?? prisma;
  return client.credentialFusion.findUnique({
    where: { clinicianId },
  });
}

async function loadSources(
  client: PrismaClient,
  clinicianId: string,
  userId: string | number | null,
): Promise<FusionSourceSnapshot> {
  const [usLicenses, globalLicenses, dea, compacts, employment] = await Promise.all([
    client.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    client.globalLicense.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    client.dEACredential.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    client.compactEligibility.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    fetchEmploymentCredentials(client, userId),
  ]);

  return {
    usLicenses,
    globalLicenses,
    dea,
    compacts,
    employment,
  };
}

async function fetchEmploymentCredentials(
  client: PrismaClient,
  userId: string | number | null,
) {
  if (!userId) return [];
  return client.credential.findMany({
    where: {
      userId: String(userId),
      OR: [
        {
          type: { contains: 'employment', mode: 'insensitive' },
        },
        {
          name: { contains: 'employment', mode: 'insensitive' },
        },
      ],
    },
    orderBy: { issuedAt: 'desc' },
  });
}

async function loadTrustDirectory(client: PrismaClient) {
  const entries = await client.trustWeight.findMany();
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    map.set(entry.issuerDid, clamp01(entry.weight ?? 0.5));
  });
  return map;
}

function buildCandidateGroups(
  sources: FusionSourceSnapshot,
  now: Date,
): Map<string, FusionCandidate[]> {
  const groups = new Map<string, FusionCandidate[]>();

  const register = (candidate: FusionCandidate) => {
    const key = `${candidate.type}:${candidate.key}`;
    const existing = groups.get(key) ?? [];
    existing.push(candidate);
    groups.set(key, existing);
  };

  sources.usLicenses.forEach((license) => register(mapStateLicense(license, now)));
  sources.globalLicenses.forEach((record) => register(mapGlobalLicense(record, now)));
  sources.dea.forEach((record) => register(mapDeaRecord(record, now)));
  sources.compacts.forEach((record) => register(mapCompactEligibility(record, now)));
  sources.employment.forEach((credential) => register(mapEmploymentCredential(credential, now)));

  return groups;
}

function mapStateLicense(
  license: Prisma.StateLicenseVerificationGetPayload<{}>,
  now: Date,
): FusionCandidate {
  const key = `${license.state ?? 'UNK'}:${license.licenseNumber ?? license.id}`;
  const metadata = coerceRecord(license.metadata);

  return {
    sourceId: license.id,
    type: 'us_license',
    key,
    label: `${license.state ?? 'State'} ${license.licenseNumber ?? license.id}`,
    status: deriveStatusFromDate(license.expiryDate, license.status, now),
    issuer: license.state ?? metadata?.issuingAuthority ?? null,
    issuerDid: metadata?.issuerDid ? String(metadata.issuerDid) : null,
    trustWeight: metadata?.source === 'state_board' ? 0.95 : 0.82,
    updatedAt:
      license.updatedAt?.toISOString() ??
      license.verifiedAt?.toISOString() ??
      now.toISOString(),
    anchor: (metadata?.anchorTxHash as string | undefined) ?? null,
    payload: {
      state: license.state,
      licenseNumber: license.licenseNumber,
      status: license.status,
      issueDate: license.issueDate?.toISOString() ?? null,
      expiresAt: license.expiryDate?.toISOString() ?? null,
      verifiedAt: license.verifiedAt?.toISOString() ?? null,
      source: metadata?.source ?? 'state_board',
    },
    raw: serialize(license),
  };
}

function mapGlobalLicense(
  record: Prisma.GlobalLicenseGetPayload<{}>,
  now: Date,
): FusionCandidate {
  const key = `${record.country ?? 'INTL'}:${record.licenseNumber ?? record.id}`;
  const metadata = coerceRecord(record.metadata);
  return {
    sourceId: record.id,
    type: 'global_license',
    key,
    label: `${record.country ?? 'INTL'} ${record.authority ?? ''}`.trim(),
    status: deriveStatusFromDate(record.expiresAt, record.status, now),
    issuer: record.authority ?? null,
    issuerDid: metadata?.issuerDid ? String(metadata.issuerDid) : null,
    trustWeight: typeof record.provenanceScore === 'number' ? clamp01(record.provenanceScore / 100) : 0.75,
    updatedAt: record.updatedAt?.toISOString() ?? now.toISOString(),
    anchor: record.anchorTxHash ?? null,
    payload: {
      country: record.country,
      authority: record.authority,
      licenseNumber: record.licenseNumber,
      status: record.status,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      equivalencyLevel: record.equivalencyLevel ?? null,
      anchorTxHash: record.anchorTxHash ?? null,
    },
    raw: serialize(record),
  };
}

function mapDeaRecord(record: Prisma.DEACredentialGetPayload<{}>, now: Date): FusionCandidate {
  const metadata = coerceRecord(record.metadata);
  const status = metadata?.status as string | undefined;
  return {
    sourceId: record.id,
    type: 'dea_mate',
    key: record.deaNumber ?? record.id,
    label: `DEA ${record.deaNumber ?? record.id}`,
    status: deriveStatusFromDate(record.expiration, status, now),
    issuer: 'DEA',
    issuerDid: metadata?.issuerDid ? String(metadata.issuerDid) : null,
    trustWeight: 0.9,
    updatedAt: record.updatedAt?.toISOString() ?? now.toISOString(),
    anchor: null,
    payload: {
      deaNumber: record.deaNumber,
      expiresAt: record.expiration?.toISOString() ?? null,
      mateHours: record.mateHours,
    },
    raw: serialize(record),
  };
}

function mapCompactEligibility(
  record: Prisma.CompactEligibilityGetPayload<{}>,
  now: Date,
): FusionCandidate {
  const summary = coerceRecord(record.rationale);
  return {
    sourceId: record.id,
    type: 'compact',
    key: record.compact,
    label: `${record.compact} eligibility`,
    status: record.eligible ? 'active' : 'revoked',
    issuer: record.compact,
    issuerDid: null,
    trustWeight: record.eligible ? 0.88 : 0.5,
    updatedAt: record.updatedAt?.toISOString() ?? now.toISOString(),
    anchor: null,
    payload: {
      compact: record.compact,
      eligible: record.eligible,
      evaluatedAt: summary?.evaluatedAt ?? record.updatedAt?.toISOString() ?? null,
      authorizedStates: summary?.authorizedStates ?? [],
    },
    raw: serialize(record),
  };
}

function mapEmploymentCredential(
  credential: Prisma.CredentialGetPayload<{}>,
  now: Date,
): FusionCandidate {
  const metadata = coerceRecord(credential.metadata);
  const subject = coerceRecord(credential.credentialSubject);
  const trustFrameworks = (metadata?.trustFrameworks as string[] | undefined) ?? [];
  const trust = trustFrameworks.some((framework) =>
    framework.toLowerCase().includes('tefca'),
  )
    ? 0.9
    : 0.65;

  return {
    sourceId: credential.id,
    type: 'employment',
    key: credential.id,
    label: metadata?.organization ?? subject?.organization ?? credential.name ?? credential.id,
    status: deriveStatusFromDate(credential.expiresAt, credential.status, now),
    issuer: credential.issuer ?? metadata?.issuer ?? null,
    issuerDid: metadata?.issuerDid ? String(metadata.issuerDid) : null,
    trustWeight: trust,
    updatedAt:
      credential.updatedAt?.toISOString() ??
      credential.issuedAt?.toISOString() ??
      now.toISOString(),
    anchor: metadata?.anchorTxHash ? String(metadata.anchorTxHash) : null,
    payload: {
      organization: metadata?.organization ?? subject?.organization ?? null,
      roleTitle: metadata?.role ?? metadata?.title ?? subject?.roleTitle ?? null,
      startDate: metadata?.startDate ?? subject?.startDate ?? credential.issuedAt?.toISOString() ?? null,
      endDate: metadata?.endDate ?? subject?.endDate ?? credential.expiresAt?.toISOString() ?? null,
      trustFrameworks,
      status: credential.status,
    },
    raw: serialize(credential),
  };
}

function buildTimeline(components: FusionComponent[]): FusionTimelineEvent[] {
  const events: FusionTimelineEvent[] = [];
  components.forEach((component) => {
    const issueDate =
      parseDate(component.fields.issueDate) ??
      parseDate(component.fields.issuedAt) ??
      parseDate(component.fields.startDate);
    const expiryDate =
      parseDate(component.fields.expiresAt) ??
      parseDate(component.fields.expiryDate) ??
      parseDate(component.fields.endDate);

    if (issueDate) {
      events.push({
        id: `${component.id}:issued`,
        componentId: component.id,
        type: component.type,
        label: component.type === 'employment' ? 'Start' : 'Issued',
        status: 'active',
        occurredAt: issueDate.toISOString(),
        context: component.label,
      });
    }

    if (expiryDate) {
      events.push({
        id: `${component.id}:expires`,
        componentId: component.id,
        type: component.type,
        label: 'Expires',
        status: expiryDate.getTime() < Date.now() ? 'expired' : component.status,
        occurredAt: expiryDate.toISOString(),
        context: component.label,
      });
    }
  });

  return events.sort((a, b) => (a.occurredAt > b.occurredAt ? -1 : 1));
}

function buildSummary(
  sources: FusionSourceSnapshot,
  components: FusionComponent[],
): FusedCredentialRecord['summary'] {
  const activeComponents = components.filter((component) => component.status === 'active').length;
  const expiredComponents = components.filter((component) => component.status === 'expired').length;
  const sourceCount =
    sources.usLicenses.length +
    sources.globalLicenses.length +
    sources.dea.length +
    sources.compacts.length +
    sources.employment.length;
  return {
    componentCount: components.length,
    activeComponents,
    expiredComponents,
    sourceCount,
  };
}

async function persistFusionSnapshot(
  client: PrismaClient,
  clinicianId: string,
  sources: FusionSourceSnapshot,
  fused: FusedCredentialRecord,
) {
  const payload = {
    sources: serialize(sources),
    fusedRecord: serialize(fused),
  };

  await client.credentialFusion.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      sources: payload.sources,
      fusedRecord: payload.fusedRecord,
    },
    update: {
      sources: payload.sources,
      fusedRecord: payload.fusedRecord,
    },
  });
}

function deriveStatusFromDate(
  date: Date | string | null | undefined,
  status: string | null | undefined,
  now: Date,
) {
  if (status && status.toLowerCase().includes('revoked')) {
    return 'revoked' as const;
  }
  const parsed = parseDate(date);
  if (!parsed) {
    return 'active' as const;
  }
  return parsed.getTime() < now.getTime() ? 'expired' : 'active';
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function coerceRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, any>;
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function computeRootHash(components: FusionComponent[]): string {
  const normalized = components
    .map((component) => ({
      id: component.id,
      status: component.status,
      fields: component.fields,
      chosenSourceId: component.chosenSourceId,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

