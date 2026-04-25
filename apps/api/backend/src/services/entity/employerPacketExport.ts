import archiver from 'archiver';
import { PassThrough } from 'stream';
import { stableStringify } from '../../utils/deterministic';
import {
  EMPLOYER_EVIDENCE_PACKET_BUNDLE_FILES,
  type EmployerEvidencePacketV1,
} from './employerPacket';
import {
  assertTrustContainerManifestHasNoSecrets,
  trustContainerDisplayLabel,
} from '../trust/container/trustContainerManifest';

export interface EmployerEvidencePacketBundleContents {
  packetJson: string;
  manifestJson: string;
  sourceCoverageJson: string;
  statusJson: string;
  readmeTxt: string;
}

export interface EmployerEvidencePacketSourceCoverageV1 {
  schema: 'vitalcv.employer.packet-source-coverage.v1';
  exportedAt: string;
  exportedBy: string;
  entityId: string;
  clinicianNpi: string;
  sourceCoverage: EmployerEvidencePacketV1['sourceCoverage'];
  sourceCoverageSummary: EmployerEvidencePacketV1['sourceCoverageSummary'];
  manifestSources: EmployerEvidencePacketV1['manifest']['sources'];
}

export interface EmployerEvidencePacketStatusV1 {
  schema: 'vitalcv.employer.packet-status.v1';
  exportedAt: string;
  exportedBy: string;
  entityId: string;
  clinicianNpi: string;
  truth: EmployerEvidencePacketV1['truth'];
  freshness: EmployerEvidencePacketV1['freshness'];
  readiness: EmployerEvidencePacketV1['readiness'];
  decisionPosture: EmployerEvidencePacketV1['decisionPosture'];
  sourceCoverageSummary: EmployerEvidencePacketV1['sourceCoverageSummary'];
}

function buildSourceCoverageDocument(
  packet: EmployerEvidencePacketV1,
): EmployerEvidencePacketSourceCoverageV1 {
  return {
    schema: 'vitalcv.employer.packet-source-coverage.v1',
    exportedAt: packet.exportedAt,
    exportedBy: packet.exportedBy,
    entityId: packet.entityId,
    clinicianNpi: packet.clinicianNpi,
    sourceCoverage: packet.sourceCoverage,
    sourceCoverageSummary: packet.sourceCoverageSummary,
    manifestSources: packet.manifest.sources,
  };
}

function buildStatusDocument(
  packet: EmployerEvidencePacketV1,
): EmployerEvidencePacketStatusV1 {
  return {
    schema: 'vitalcv.employer.packet-status.v1',
    exportedAt: packet.exportedAt,
    exportedBy: packet.exportedBy,
    entityId: packet.entityId,
    clinicianNpi: packet.clinicianNpi,
    truth: packet.truth,
    freshness: packet.freshness,
    readiness: packet.readiness,
    decisionPosture: packet.decisionPosture,
    sourceCoverageSummary: packet.sourceCoverageSummary,
  };
}

function buildReadme(packet: EmployerEvidencePacketV1): string {
  const summary = packet.sourceCoverageSummary;
  const trustContainer = packet.manifest.trustContainer;
  const limitationNotes = trustContainer?.limitationNotes ?? [];

  return [
    'VitalCV Employer Evidence Packet',
    '',
    `Entity ID: ${packet.entityId}`,
    `Clinician NPI: ${packet.clinicianNpi}`,
    `Exported At: ${packet.exportedAt}`,
    `Exported By: ${packet.exportedBy}`,
    '',
    'Truth Statuses',
    `- Identity: ${packet.truth.identity.status}`,
    `- Safety: ${packet.truth.safety.status}`,
    `- Authority: ${packet.truth.authority.status}`,
    `- Eligibility: ${packet.truth.eligibility.status}`,
    '',
    'Launch Spine Coverage',
    `- Checked: ${summary.checked.join(', ') || 'none'}`,
    `- Stale: ${summary.stale.join(', ') || 'none'}`,
    `- Pending: ${summary.pending.join(', ') || 'none'}`,
    `- Access required: ${summary.accessRequired.join(', ') || 'none'}`,
    `- Review required: ${summary.reviewRequired.join(', ') || 'none'}`,
    `- Unavailable: ${summary.unavailable.join(', ') || 'none'}`,
    '',
    `Receipt References: ${packet.receiptReferences.length}`,
    `Artifact References: ${packet.artifactReferences.length}`,
    `Freshness State: ${packet.freshness.state}`,
    `Freshness Label: ${packet.freshness.label}`,
    `Decision posture: ${packet.decisionPosture.status}`,
    `Safe next action: ${packet.decisionPosture.nextAction}`,
    '',
    `${trustContainerDisplayLabel(trustContainer)}`,
    ...(trustContainer?.trustContainerId
      ? [`Credential container id: ${trustContainer.trustContainerId}`]
      : []),
    ...(trustContainer?.skipReason
      ? [`Credential container skip reason: ${trustContainer.skipReason}`]
      : []),
    ...(limitationNotes.length > 0
      ? [
          'Credential container limitations:',
          ...limitationNotes.map((limitation) => `- ${limitation}`),
        ]
      : []),
    '',
    'Bundle Files',
    ...EMPLOYER_EVIDENCE_PACKET_BUNDLE_FILES.map((file) => `- ${file}`),
  ].join('\n');
}

export function buildEmployerEvidencePacketBundleContents(
  packet: EmployerEvidencePacketV1,
): EmployerEvidencePacketBundleContents {
  // Defence-in-depth: make sure no secret material ever rides out on the
  // trust-container entry. The type doesn't have slots for secrets, but a
  // careless caller could splat them in; this guard fails loudly if so.
  if (packet.manifest.trustContainer) {
    assertTrustContainerManifestHasNoSecrets(packet.manifest.trustContainer);
  }
  return {
    packetJson: stableStringify(packet),
    manifestJson: stableStringify(packet.manifest),
    sourceCoverageJson: stableStringify(buildSourceCoverageDocument(packet)),
    statusJson: stableStringify(buildStatusDocument(packet)),
    readmeTxt: buildReadme(packet),
  };
}

export function createEmployerEvidencePacketZipStream(
  packet: EmployerEvidencePacketV1,
): PassThrough {
  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });
  const bundle = buildEmployerEvidencePacketBundleContents(packet);
  const prefix = `vitalcv-packet-${packet.clinicianNpi || packet.entityId}`;

  archive.pipe(passthrough);
  archive.append(bundle.packetJson, { name: `${prefix}/packet.json` });
  archive.append(bundle.manifestJson, { name: `${prefix}/manifest.json` });
  archive.append(bundle.sourceCoverageJson, { name: `${prefix}/source-coverage.json` });
  archive.append(bundle.statusJson, { name: `${prefix}/status.json` });
  archive.append(bundle.readmeTxt, { name: `${prefix}/README.txt` });
  void archive.finalize();

  return passthrough;
}
