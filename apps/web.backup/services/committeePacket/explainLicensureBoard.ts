import {
  ComplianceItem,
  DriftEvent,
  EvidencePoint,
  ExplainSectionOptions,
  LicensureBoardProfile,
  SectionNarrative,
  SeverityLevel,
} from './narrativeTypes';
import {
  DEFAULT_HIGHLIGHT_LIMIT,
  compareBySeverity,
  dedupeStrings,
  emptySection,
  formatDate,
  limitList,
  severityWeight,
} from './utils';

export function explainLicensureAndBoardSection(
  profile?: LicensureBoardProfile,
  options?: ExplainSectionOptions
): SectionNarrative {
  if (!profile) {
    return emptySection('licensure');
  }

  const highlightLimit = options?.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const deterministic = options?.deterministic ?? false;

  const licenses = [...(profile.licenses ?? [])];
  const boards = [...(profile.boardCertifications ?? [])];

  const activeLicenses = licenses.filter((item) => item.status === 'ACTIVE');
  const expiringLicenses = licenses.filter((item) => item.status === 'EXPIRING_SOON');
  const expiredLicenses = licenses.filter(
    (item) => item.status === 'EXPIRED' || item.status === 'SUSPENDED'
  );

  const activeBoards = boards.filter((item) => item.status === 'ACTIVE');
  const expiringBoards = boards.filter((item) => item.status === 'EXPIRING_SOON');
  const expiredBoards = boards.filter((item) => item.status === 'EXPIRED');

  const summaryParts = [
    `${activeLicenses.length} active license${activeLicenses.length === 1 ? '' : 's'}`,
    `${activeBoards.length} active board cert${activeBoards.length === 1 ? '' : 's'}`,
  ];

  if (expiringLicenses.length === 0 && expiringBoards.length === 0) {
    summaryParts.push('no upcoming expirations within watch window');
  } else {
    summaryParts.push(
      `${expiringLicenses.length + expiringBoards.length} credential(s) expiring soon`
    );
  }

  if (expiredLicenses.length > 0 || expiredBoards.length > 0) {
    summaryParts.push('action required on expired credentials');
  }

  const highlights: string[] = [];

  if (activeLicenses.length > 0) {
    highlights.push(
      `${activeLicenses.length} license${activeLicenses.length === 1 ? '' : 's'} verified ${
        mostRecentVerification(activeLicenses) ?? 'recently'
      }.`
    );
  }

  if (activeBoards.length > 0) {
    highlights.push('Board certifications current.');
  }

  if (
    expiredLicenses.length === 0 &&
    expiredBoards.length === 0 &&
    expiringLicenses.length === 0 &&
    expiringBoards.length === 0
  ) {
    highlights.push('No license or board expirations within next review window.');
  }

  const concerns: string[] = [];

  expiredLicenses.forEach((license) => {
    concerns.push(
      `${license.label}${license.jurisdiction ? ` (${license.jurisdiction})` : ''} ${
        license.status.toLowerCase() ?? 'expired'
      }${license.expiresAt ? ` on ${formatDate(license.expiresAt)}` : ''}.`
    );
  });

  expiredBoards.forEach((cert) => {
    concerns.push(
      `${cert.label} board certification expired${
        cert.expiresAt ? ` ${formatDate(cert.expiresAt)}` : ''
      }.`
    );
  });

  expiringLicenses.forEach((license) => {
    concerns.push(
      `${license.label} expiring ${formatDate(license.expiresAt)} – renewal evidence pending.`
    );
  });

  expiringBoards.forEach((cert) => {
    concerns.push(`${cert.label} board certification expiring ${formatDate(cert.expiresAt)}.`);
  });

  const openInvestigations = profile.investigations?.filter(
    (item) => item.status === 'OPEN'
  );
  openInvestigations?.forEach((investigation) => {
    concerns.push(
      `Investigation (${investigation.severity}) opened ${formatDate(
        investigation.openedAt
      )} – ${investigation.description}.`
    );
  });

  const unresolvedDrift = profile.driftEvents?.filter((event) => !event.resolved) ?? [];
  unresolvedDrift.forEach((event) => {
    concerns.push(
      `Drift: ${event.label} (${event.category}) on ${formatDate(event.detectedAt)} – ${
        event.description
      }.`
    );
  });

  const evidence: EvidencePoint[] = [];

  licenses
    .sort((a, b) =>
      compareBySeverity(
        a.severity ?? inferSeverityFromStatus(a.status),
        b.severity ?? inferSeverityFromStatus(b.status)
      )
    )
    .forEach((license) => {
      evidence.push(mapCredentialToEvidence(license, 'License'));
    });

  boards.forEach((cert) => {
    evidence.push(mapCredentialToEvidence(cert, 'Board certification'));
  });

  openInvestigations?.forEach((investigation) => {
    evidence.push({
      id: investigation.id,
      label: 'Licensure investigation',
      severity: investigation.severity,
      detail: `${investigation.description} (opened ${formatDate(investigation.openedAt)})`,
      sectionRef: 'licensure',
    });
  });

  unresolvedDrift.forEach((event) => {
    evidence.push(mapDriftToEvidence(event));
  });

  return {
    section: 'licensure',
    summary: summaryParts.join(' • '),
    highlights: limitList(dedupeStrings(highlights), highlightLimit),
    concerns: dedupeStrings(concerns),
    evidence: deterministic ? limitList(evidence, highlightLimit * 2) : evidence,
    confidence: licenses.length > 0 ? 'high' : 'medium',
  };
}

function mostRecentVerification(items: ComplianceItem[]): string | undefined {
  if (items.length === 0) return undefined;
  const latest = items
    .filter((item) => item.lastVerifiedAt)
    .sort((a, b) => (b.lastVerifiedAt ?? '').localeCompare(a.lastVerifiedAt ?? ''))[0];
  return latest ? formatDate(latest.lastVerifiedAt) : undefined;
}

function inferSeverityFromStatus(status: ComplianceItem['status']): SeverityLevel {
  switch (status) {
    case 'ACTIVE':
      return 'low';
    case 'EXPIRING_SOON':
      return 'medium';
    case 'EXPIRED':
    case 'SUSPENDED':
      return 'high';
    case 'MISSING':
      return 'critical';
    default:
      return 'info';
  }
}

function mapCredentialToEvidence(item: ComplianceItem, prefix: string): EvidencePoint {
  return {
    id: item.id,
    label: `${prefix}: ${item.label}`,
    severity: item.severity ?? inferSeverityFromStatus(item.status),
    detail: `${item.status.toLowerCase()}${
      item.jurisdiction ? ` • ${item.jurisdiction}` : ''
    }${item.expiresAt ? ` • expires ${formatDate(item.expiresAt)}` : ''}`,
    observedAt: item.lastVerifiedAt,
    sectionRef: 'licensure',
  };
}

function mapDriftToEvidence(event: DriftEvent): EvidencePoint {
  return {
    id: event.id,
    label: `Drift: ${event.label}`,
    severity: event.severity,
    detail: event.description,
    observedAt: event.detectedAt,
    sectionRef: 'licensure',
  };
}

import { getServiceLogger } from '../logging/serviceLogger';
import {
  ComplianceItem,
  DriftEvent,
  EvidencePoint,
  ExplainSectionOptions,
  LicensureBoardProfile,
  SectionNarrative,
} from './types';
import {
  DEFAULT_HIGHLIGHT_LIMIT,
  compareBySeverity,
  dedupeStrings,
  emptySection,
  formatDate,
  limitList,
  severityWeight,
} from './utils';

const log = getServiceLogger('committeePacket/explainLicensure');

export function explainLicensureAndBoardSection(
  profile?: LicensureBoardProfile,
  options?: ExplainSectionOptions
): SectionNarrative {
  if (!profile) {
    log.warn('Licensure profile missing; returning empty section');
    return emptySection('licensure');
  }

  const highlightLimit = options?.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const deterministic = options?.deterministic ?? false;

  const licenses = [...(profile.licenses ?? [])];
  const boards = [...(profile.boardCertifications ?? [])];

  const activeLicenses = licenses.filter((item) => item.status === 'ACTIVE');
  const expiringLicenses = licenses.filter((item) => item.status === 'EXPIRING_SOON');
  const expiredLicenses = licenses.filter(
    (item) => item.status === 'EXPIRED' || item.status === 'SUSPENDED'
  );

  const activeBoards = boards.filter((item) => item.status === 'ACTIVE');
  const expiringBoards = boards.filter((item) => item.status === 'EXPIRING_SOON');
  const expiredBoards = boards.filter((item) => item.status === 'EXPIRED');

  const summaryParts = [
    `${activeLicenses.length} active license${activeLicenses.length === 1 ? '' : 's'}`,
    `${activeBoards.length} active board cert${activeBoards.length === 1 ? '' : 's'}`,
  ];

  if (expiringLicenses.length === 0 && expiringBoards.length === 0) {
    summaryParts.push('no upcoming expirations within watch window');
  } else {
    summaryParts.push(
      `${expiringLicenses.length + expiringBoards.length} credential(s) expiring soon`
    );
  }

  if (expiredLicenses.length > 0 || expiredBoards.length > 0) {
    summaryParts.push('action required on expired credentials');
  }

  const highlights: string[] = [];

  if (activeLicenses.length > 0) {
    highlights.push(
      `${activeLicenses.length} license${activeLicenses.length === 1 ? '' : 's'} verified ${
        mostRecentVerification(activeLicenses) ?? 'recently'
      }.`
    );
  }

  if (activeBoards.length > 0) {
    highlights.push('Board certifications current.');
  }

  if (
    expiredLicenses.length === 0 &&
    expiredBoards.length === 0 &&
    expiringLicenses.length === 0 &&
    expiringBoards.length === 0
  ) {
    highlights.push('No license or board expirations within next review window.');
  }

  const concerns: string[] = [];

  expiredLicenses.forEach((license) => {
    concerns.push(
      `${license.label} ${license.jurisdiction ? `(${license.jurisdiction}) ` : ''}${
        license.status.toLowerCase() ?? 'expired'
      }${license.expiresAt ? ` on ${formatDate(license.expiresAt)}` : ''}.`
    );
  });

  expiredBoards.forEach((cert) => {
    concerns.push(
      `${cert.label} board certification expired${
        cert.expiresAt ? ` ${formatDate(cert.expiresAt)}` : ''
      }.`
    );
  });

  expiringLicenses.forEach((license) => {
    concerns.push(
      `${license.label} expiring ${formatDate(license.expiresAt)} – renewal evidence pending.`
    );
  });

  expiringBoards.forEach((cert) => {
    concerns.push(`${cert.label} board certification expiring ${formatDate(cert.expiresAt)}.`);
  });

  const openInvestigations = profile.investigations?.filter(
    (item) => item.status === 'OPEN'
  );
  openInvestigations?.forEach((investigation) => {
    concerns.push(
      `Investigation (${investigation.severity}) opened ${formatDate(
        investigation.openedAt
      )} – ${investigation.description}.`
    );
  });

  const unresolvedDrift = profile.driftEvents?.filter((event) => !event.resolved) ?? [];
  unresolvedDrift.forEach((event) => {
    concerns.push(
      `Drift: ${event.label} (${event.category}) on ${formatDate(event.detectedAt)} – ${
        event.description
      }.`
    );
  });

  const evidence: EvidencePoint[] = [];

  licenses
    .sort((a, b) =>
      compareBySeverity(a.severity ?? inferSeverityFromStatus(a.status), b.severity ?? inferSeverityFromStatus(b.status))
    )
    .forEach((license) => {
      evidence.push(mapCredentialToEvidence(license, 'License'));
    });

  boards.forEach((cert) => {
    evidence.push(mapCredentialToEvidence(cert, 'Board certification'));
  });

  openInvestigations?.forEach((investigation) => {
    evidence.push({
      id: investigation.id,
      label: 'Licensure investigation',
      severity: investigation.severity,
      detail: `${investigation.description} (opened ${formatDate(investigation.openedAt)})`,
      sectionRef: 'licensure',
    });
  });

  unresolvedDrift.forEach((event) => {
    evidence.push(mapDriftToEvidence(event));
  });

  return {
    section: 'licensure',
    summary: summaryParts.join(' • '),
    highlights: limitList(dedupeStrings(highlights), highlightLimit),
    concerns: dedupeStrings(concerns),
    evidence: deterministic ? limitList(evidence, highlightLimit * 2) : evidence,
    confidence: licenses.length > 0 ? 'high' : 'medium',
  };
}

function mostRecentVerification(items: ComplianceItem[]): string | undefined {
  if (items.length === 0) return undefined;
  const latest = items
    .filter((item) => item.lastVerifiedAt)
    .sort((a, b) => (b.lastVerifiedAt ?? '').localeCompare(a.lastVerifiedAt ?? ''))[0];
  return latest ? formatDate(latest.lastVerifiedAt) : undefined;
}

function inferSeverityFromStatus(status: ComplianceItem['status']): 'low' | 'medium' | 'high' | 'critical' | 'info' {
  switch (status) {
    case 'ACTIVE':
      return 'low';
    case 'EXPIRING_SOON':
      return 'medium';
    case 'EXPIRED':
    case 'SUSPENDED':
      return 'high';
    case 'MISSING':
      return 'critical';
    default:
      return 'info';
  }
}

function mapCredentialToEvidence(item: ComplianceItem, prefix: string): EvidencePoint {
  return {
    id: item.id,
    label: `${prefix}: ${item.label}`,
    severity: item.severity ?? inferSeverityFromStatus(item.status),
    detail: `${item.status.toLowerCase()}${
      item.jurisdiction ? ` • ${item.jurisdiction}` : ''
    }${item.expiresAt ? ` • expires ${formatDate(item.expiresAt)}` : ''}`,
    observedAt: item.lastVerifiedAt,
    sectionRef: 'licensure',
  };
}

function mapDriftToEvidence(event: DriftEvent): EvidencePoint {
  return {
    id: event.id,
    label: `Drift: ${event.label}`,
    severity: event.severity,
    detail: event.description,
    observedAt: event.detectedAt,
    sectionRef: 'licensure',
  };
}


