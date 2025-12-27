import crypto from 'crypto';
import prisma from '../../graphql/prisma_client';
import {
  EmployerReadinessSummary,
  ReadinessStatus,
  RequirementEvidence,
  RequirementStatus,
} from './models';
import { determineReadinessStatus } from '../readiness/summary';
import { explainReadiness } from '../readiness/explain';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeId(raw: string): number | null {
  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber > 0) return asNumber;
  return null;
}

function buildRequirement(params: {
  requirementId: string;
  label: string;
  status: RequirementStatus;
  evidence?: string[];
  gaps?: string[];
  remediation?: string;
}): RequirementEvidence {
  return {
    requirementId: params.requirementId,
    label: params.label,
    status: params.status,
    evidence: params.evidence ?? [],
    gaps: params.gaps ?? [],
    remediation: params.remediation,
  };
}

async function recordAuditEvent(summary: EmployerReadinessSummary): Promise<string> {
  const hash = sha256Hex(
    JSON.stringify({
      clinicianId: summary.clinicianId,
      jobId: summary.jobId,
      status: summary.status,
      requirements: summary.requirements.map((r) => ({
        requirementId: r.requirementId,
        status: r.status,
      })),
    }),
  );

  await prisma.auditEvent.create({
    data: {
      type: 'EMPLOYER_READINESS_VIEW',
      hash,
      metadata: {
        clinicianId: summary.clinicianId,
        jobId: summary.jobId,
        status: summary.status,
        requirements: summary.requirements.map((r) => ({
          requirementId: r.requirementId,
          status: r.status,
          gaps: r.gaps,
        })),
        generatedAt: summary.generatedAt,
      },
    },
  });

  return hash;
}

function buildRoleAlignmentRequirement(options: {
  clinicianExists: boolean;
  jobTitle?: string;
  credentials: { name: string }[];
}): RequirementEvidence {
  if (!options.clinicianExists) {
    return buildRequirement({
      requirementId: 'role_alignment',
      label: 'Role-aligned credential evidence',
      status: 'NOT_MET',
      gaps: ['Clinician profile must be located before evaluating credentials.'],
      remediation: 'Verify clinician onboarding and identity anchoring.',
    });
  }

  if (options.credentials.length === 0) {
    return buildRequirement({
      requirementId: 'role_alignment',
      label: 'Role-aligned credential evidence',
      status: 'NOT_MET',
      gaps: ['No verifiable credentials are on file for this clinician.'],
      remediation: 'Request at least one role-relevant credential with issuer attestation.',
    });
  }

  if (!options.jobTitle) {
    return buildRequirement({
      requirementId: 'role_alignment',
      label: 'Role-aligned credential evidence',
      status: 'PARTIAL',
      evidence: options.credentials.map((c) => c.name),
      gaps: ['Job requisition is missing a title, so alignment cannot be fully validated.'],
      remediation: 'Associate a job title to evaluate credential fit.',
    });
  }

  const normalizedTitle = options.jobTitle.toLowerCase();
  const aligned = options.credentials.filter((c) =>
    c.name.toLowerCase().includes(normalizedTitle),
  );

  if (aligned.length > 0) {
    return buildRequirement({
      requirementId: 'role_alignment',
      label: 'Role-aligned credential evidence',
      status: 'MET',
      evidence: aligned.map((c) => c.name),
      remediation: 'Confirm issuer status checks before extending offers.',
    });
  }

  return buildRequirement({
    requirementId: 'role_alignment',
    label: 'Role-aligned credential evidence',
    status: 'PARTIAL',
    evidence: options.credentials.map((c) => c.name),
    gaps: ['Credentials are present but do not mention the requested role.'],
    remediation: 'Collect a credential that explicitly references the job scope.',
  });
}

export async function getEmployerReadiness(
  clinicianId: string,
  jobId: string,
): Promise<EmployerReadinessSummary> {
  const clinicianPk = normalizeId(clinicianId);
  const jobPk = normalizeId(jobId);

  const clinician = clinicianPk
    ? await prisma.user.findUnique({
        where: { id: clinicianPk },
      })
    : null;

  const job = jobPk ? await prisma.job.findUnique({ where: { id: jobPk } }) : null;

  const credentials =
    clinicianPk && clinician
      ? await prisma.credential.findMany({
          where: { userId: clinicianPk },
          select: { name: true },
        })
      : [];

  const requirements: RequirementEvidence[] = [
    buildRequirement({
      requirementId: 'clinician_profile',
      label: 'Clinician identity anchored',
      status: clinician ? 'MET' : 'NOT_MET',
      evidence: clinician ? [`Clinician #${clinician.id} located`] : [],
      gaps: clinician ? [] : ['Clinician profile not found in the directory.'],
      remediation: clinician ? undefined : 'Onboard clinician and validate identity (no PHI).',
    }),
    buildRequirement({
      requirementId: 'job_requisition',
      label: 'Job requisition located',
      status: job ? 'MET' : 'NOT_MET',
      evidence: job ? [`Job #${job.id} (${job.title}) is available`] : [],
      gaps: job ? [] : ['Job not found or unpublished.'],
      remediation: job ? undefined : 'Confirm jobId and ensure the requisition is published.',
    }),
    buildRoleAlignmentRequirement({
      clinicianExists: Boolean(clinician),
      jobTitle: job?.title,
      credentials,
    }),
  ];

  const status: ReadinessStatus = determineReadinessStatus(requirements);

  const summary: EmployerReadinessSummary = {
    clinicianId: String(clinicianId),
    jobId: String(jobId),
    jobTitle: job?.title,
    status,
    generatedAt: new Date().toISOString(),
    requirements,
    rationale: [],
  };

  summary.rationale = explainReadiness(summary);
  summary.auditRef = await recordAuditEvent(summary);

  return summary;
}
