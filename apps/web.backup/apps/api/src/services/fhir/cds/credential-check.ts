import { randomUUID } from 'crypto';
import { logFhirActivity } from '../activity-log';

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface PractitionerRoleResource {
  resourceType: 'PractitionerRole';
  id?: string;
  practitioner?: FhirReference;
  organization?: FhirReference;
  code?: Array<{ text?: string }>;
  specialty?: Array<{ text?: string }>;
  location?: FhirReference[];
  period?: {
    start?: string;
    end?: string;
  };
  credential?: Array<{
    code?: {
      text?: string;
    };
    period?: {
      start?: string;
      end?: string;
    };
    status?: string;
  }>;
}

export interface EncounterResource {
  resourceType: 'Encounter';
  id?: string;
  status?: string;
  class?: {
    code?: string;
  };
  period?: {
    start?: string;
    end?: string;
  };
  location?: Array<{
    location?: FhirReference;
  }>;
}

export interface CredentialCheckInput {
  context: {
    practitionerRole?: PractitionerRoleResource;
    encounter?: EncounterResource;
  };
  fhirServer?: string;
}

export interface CDSHookCard {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical' | 'success';
  source: {
    label: string;
    url: string;
  };
  links?: Array<{
    label: string;
    url: string;
    type: 'absolute' | 'smart';
  }>;
}

export interface CredentialCheckResponse {
  card: CDSHookCard;
  status: 'active' | 'expired' | 'revoked' | 'unknown';
}

const PROOF_BASE = process.env.PUBLIC_WEB_URL ?? 'https://app.vitalcv.health';

export async function evaluateCredentialCheck(
  input: CredentialCheckInput,
): Promise<CredentialCheckResponse> {
  const role = input.context.practitionerRole;
  const encounter = input.context.encounter;
  const status = determineCredentialStatus(role);

  const card: CDSHookCard = {
    uuid: randomUUID(),
    summary: statusSummary(status),
    detail: buildDetailMessage(role, encounter, status),
    indicator: statusIndicator(status),
    source: {
      label: 'VitalCV Credential Monitor',
      url: PROOF_BASE,
    },
    links: buildLinks(role),
  };

  await logFhirActivity({
    kind: 'cds:credential-check',
    severity: card.indicator === 'critical' ? 'error' : card.indicator === 'warning' ? 'warning' : 'info',
    context: {
      status,
      practitionerRoleId: role?.id,
      encounterId: encounter?.id,
    },
  });

  return {
    card,
    status,
  };
}

function determineCredentialStatus(role?: PractitionerRoleResource | null): CredentialCheckResponse['status'] {
  if (!role) {
    return 'unknown';
  }

  const credential = role.credential?.[0];
  if (!credential) {
    return 'unknown';
  }

  const periodEnd = credential.period?.end ?? role.period?.end;
  if (periodEnd && Date.parse(periodEnd) < Date.now()) {
    return 'expired';
  }

  const status = (credential.status ?? '').toLowerCase();
  if (status.includes('revoked') || status.includes('suspended')) {
    return 'revoked';
  }

  return 'active';
}

function statusSummary(status: CredentialCheckResponse['status']): string {
  switch (status) {
    case 'active':
      return 'Credential Active';
    case 'expired':
      return 'Credential Expired';
    case 'revoked':
      return 'Credential Revoked';
    default:
      return 'Credential Status Unknown';
  }
}

function statusIndicator(status: CredentialCheckResponse['status']): CDSHookCard['indicator'] {
  if (status === 'revoked') {
    return 'critical';
  }
  if (status === 'expired') {
    return 'warning';
  }
  if (status === 'active') {
    return 'success';
  }
  return 'info';
}

function buildDetailMessage(
  role?: PractitionerRoleResource | null,
  encounter?: EncounterResource | null,
  status: CredentialCheckResponse['status'] = 'unknown',
): string {
  const practitioner = role?.practitioner?.display ?? role?.practitioner?.reference ?? 'Practitioner';
  const location = encounter?.location?.[0]?.location?.display ?? role?.location?.[0]?.display;
  const baseMessage =
    status === 'active'
      ? `${practitioner} is clear to proceed.`
      : status === 'expired'
        ? `${practitioner} credential expired.`
        : status === 'revoked'
          ? `${practitioner} credential revoked.`
          : `No credential records found for ${practitioner}.`;

  if (!location) {
    return baseMessage;
  }
  return `${baseMessage} Location: ${location}.`;
}

function buildLinks(role?: PractitionerRoleResource | null): CDSHookCard['links'] {
  const practitionerId = role?.practitioner?.reference?.replace('Practitioner/', '') ?? role?.practitioner?.reference;
  const url =
    practitionerId && practitionerId.startsWith('did:')
      ? `${PROOF_BASE}/wallet/${encodeURIComponent(practitionerId)}`
      : `${PROOF_BASE}/proofs/${practitionerId ?? 'practitioner'}`;
  return [
    {
      label: 'View VitalCV proof',
      url,
      type: 'absolute',
    },
  ];
}











