import { createHash } from 'crypto';
import React from 'react';
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { PassportData } from '@/lib/trust/passport-contract';
import { findPassportSourceCoverageCheck } from '@/lib/trust/source-coverage';
import { buildCareerPacket, type CareerPacketModel } from '@/lib/packet/career-packet';

export interface EmployerProofPacketSourceRow {
  source: string;
  status: string;
  checkedAt: string | null;
  detail: string;
}

export interface EmployerProofPacketPdfModel {
  clinicianName: string;
  npi: string;
  specialty: string;
  generatedAt: string;
  generatedAtLabel: string;
  sourceRows: EmployerProofPacketSourceRow[];
  /**
   * Wave 205: the shared Career Packet derivation. The PDF renders its
   * recruiter / readiness / missing-evidence / recommendations sections from
   * this so the document and the /packet UI can never disagree.
   */
  careerPacket: CareerPacketModel;
  packetHash: string;
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(parsed);
}

function normalizeCoverageStatus(state: string | null | undefined): string {
  switch (state) {
    case 'checked':
      return 'CHECKED';
    case 'stale':
      return 'STALE';
    case 'pending':
      return 'PENDING';
    case 'gated':
    case 'accessRequired':
      return 'ACCESS REQUIRED';
    case 'reviewRequired':
      return 'REVIEW REQUIRED';
    case 'unavailable':
      return 'UNAVAILABLE';
    case 'notDecisionGrade':
      return 'NOT DECISION-GRADE';
    case 'previewOnly':
      return 'PREVIEW ONLY';
    default:
      return 'UNKNOWN';
  }
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableValue(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableValue(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function resolveNppesRow(passport: PassportData): EmployerProofPacketSourceRow {
  const coverage = findPassportSourceCoverageCheck(passport.sourceCoverage, ['NPPES_API', 'NPPES']);
  return {
    source: 'NPPES',
    status: coverage?.state === 'checked' ? 'CHECKED' : normalizeCoverageStatus(coverage?.state),
    checkedAt: coverage?.checkedAt ?? passport.sources.lastFetch.NPPES_API ?? passport.lastCheckedAt ?? null,
    detail: coverage?.reason ?? 'CMS NPPES identity source not yet checked.',
  };
}

function resolveOigRow(passport: PassportData): EmployerProofPacketSourceRow {
  const coverage = findPassportSourceCoverageCheck(passport.sourceCoverage, ['OIG_LEIE', 'OIG']);
  let status = normalizeCoverageStatus(coverage?.state);

  switch (passport.standing.exclusionStatus) {
    case 'CLEAR':
      status = 'CLEARED';
      break;
    case 'EXCLUDED':
      status = 'EXCLUDED';
      break;
    case 'POSSIBLE_MATCH':
      status = 'REVIEW REQUIRED';
      break;
    case 'UNCHECKED':
      status = coverage ? normalizeCoverageStatus(coverage.state) : 'UNCHECKED';
      break;
    case 'UNKNOWN':
      status = 'UNKNOWN';
      break;
    default:
      break;
  }

  return {
    source: 'OIG/LEIE',
    status,
    checkedAt:
      passport.standing.exclusionCheckedAt
      ?? coverage?.checkedAt
      ?? passport.sources.lastFetch.OIG_LEIE
      ?? passport.lastCheckedAt
      ?? null,
    detail: coverage?.reason ?? 'OIG/LEIE screening has not been confirmed yet.',
  };
}

function resolvePecosStatus(passport: PassportData, coverageState: string | null | undefined): string {
  switch (passport.standing.pecosEnrollmentStatus) {
    case 'ENROLLED':
      return 'ENROLLED';
    case 'NOT_FOUND':
      return 'NOT FOUND';
    case 'OPTED_OUT':
      return 'OPTED OUT';
    case 'UNKNOWN':
      return 'UNKNOWN';
    case 'UNCHECKED':
      return coverageState ? normalizeCoverageStatus(coverageState) : 'UNCHECKED';
    default:
      return normalizeCoverageStatus(coverageState);
  }
}

function resolvePecosRow(passport: PassportData): EmployerProofPacketSourceRow {
  const coverage = findPassportSourceCoverageCheck(passport.sourceCoverage, ['PECOS_PUBLIC', 'PECOS', 'CMS_PECOS']);

  return {
    source: 'CMS PECOS',
    status: resolvePecosStatus(passport, coverage?.state),
    checkedAt:
      passport.standing.enrollmentObservedAt
      ?? coverage?.checkedAt
      ?? passport.sources.lastFetch.PECOS_PUBLIC
      ?? passport.lastCheckedAt
      ?? null,
    detail:
      coverage?.reason
      ?? passport.standing.enrollmentNote
      ?? 'CMS PECOS enrollment has not been confirmed yet.',
  };
}

function buildPacketHash(model: Omit<EmployerProofPacketPdfModel, 'packetHash' | 'generatedAtLabel'>): string {
  return createHash('sha256')
    .update(stableValue(model))
    .digest('hex');
}

export function buildEmployerProofPacketPdfModel(
  passport: PassportData,
  generatedAt = new Date().toISOString(),
): EmployerProofPacketPdfModel {
  const npi = passport.identity.npi ?? passport.npi ?? passport.entityId;
  const clinicianName = passport.identity.displayName || `Clinician ${npi}`;
  const specialty = passport.identity.specialty?.trim() || 'Specialty unavailable';
  const sourceRows = [
    resolveNppesRow(passport),
    resolveOigRow(passport),
    resolvePecosRow(passport),
  ];

  const baseModel = {
    clinicianName,
    npi,
    specialty,
    generatedAt,
    sourceRows,
    careerPacket: buildCareerPacket(passport),
  };

  return {
    ...baseModel,
    generatedAtLabel: formatTimestamp(generatedAt),
    packetHash: buildPacketHash(baseModel),
  };
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 36,
  },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    color: '#f8fafc',
    marginBottom: 18,
    padding: 20,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 23,
    fontWeight: 700,
    marginBottom: 8,
  },
  meta: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  metaCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginBottom: 10,
    marginRight: 10,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '31%',
  },
  metaLabel: {
    color: '#94a3b8',
    fontSize: 8,
    letterSpacing: 0.8,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: '#f8fafc',
    fontSize: 10,
    lineHeight: 1.4,
  },
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 10,
  },
  sectionCopy: {
    color: '#334155',
    fontSize: 10,
    lineHeight: 1.5,
  },
  tableHeader: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    flexDirection: 'row',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableRow: {
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sourceColumn: {
    flex: 1.4,
    paddingRight: 10,
  },
  statusColumn: {
    flex: 1,
    paddingRight: 10,
  },
  timestampColumn: {
    flex: 1.3,
    paddingRight: 10,
  },
  detailColumn: {
    flex: 2.2,
  },
  tableHeaderText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  statusBadge: {
    borderColor: '#0f172a',
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    fontSize: 9,
    fontWeight: 700,
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  footer: {
    borderTopColor: '#cbd5e1',
    borderTopStyle: 'solid',
    borderTopWidth: 1,
    bottom: 22,
    color: '#475569',
    fontSize: 9,
    left: 36,
    paddingTop: 8,
    position: 'absolute',
    right: 36,
  },
});

function EmployerProofPacketDocument({ model }: { model: EmployerProofPacketPdfModel }) {
  return (
    <Document title={`VitalCV Employer Proof Packet - ${model.npi}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>VitalCV Employer Proof Packet</Text>
          <Text style={styles.title}>{model.clinicianName}</Text>
          <Text style={styles.meta}>Credential readiness snapshot for employer review.</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>NPI</Text>
              <Text style={styles.metaValue}>{model.npi}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Specialty</Text>
              <Text style={styles.metaValue}>{model.specialty}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Generated</Text>
              <Text style={styles.metaValue}>{model.generatedAtLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verified Sources</Text>
          <Text style={styles.sectionCopy}>
            This packet captures the current source-backed identity, exclusion, and enrollment checks attached to the clinician passport at export time.
          </Text>

          <View style={styles.tableHeader}>
            <View style={styles.sourceColumn}>
              <Text style={styles.tableHeaderText}>Source</Text>
            </View>
            <View style={styles.statusColumn}>
              <Text style={styles.tableHeaderText}>Status</Text>
            </View>
            <View style={styles.timestampColumn}>
              <Text style={styles.tableHeaderText}>Checked At</Text>
            </View>
            <View style={styles.detailColumn}>
              <Text style={styles.tableHeaderText}>Detail</Text>
            </View>
          </View>

          {model.sourceRows.map((row) => (
            <View key={row.source} style={styles.tableRow} wrap={false}>
              <View style={styles.sourceColumn}>
                <Text style={styles.tableCell}>{row.source}</Text>
              </View>
              <View style={styles.statusColumn}>
                <Text style={styles.statusBadge}>{row.status}</Text>
              </View>
              <View style={styles.timestampColumn}>
                <Text style={styles.tableCell}>{row.checkedAt ? formatTimestamp(row.checkedAt) : 'Unavailable'}</Text>
              </View>
              <View style={styles.detailColumn}>
                <Text style={styles.tableCell}>{row.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recruiter View</Text>
          <Text style={styles.statusBadge}>{model.careerPacket.recruiter.label}</Text>
          <Text style={[styles.sectionCopy, { marginTop: 8 }]}>{model.careerPacket.recruiter.headline}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credential Readiness</Text>
          <Text style={styles.sectionCopy}>
            {model.careerPacket.readiness.statusLabel} — readiness score {model.careerPacket.readiness.score}
            {model.careerPacket.readiness.estimatedStartDays != null
              ? ` · est. time-to-start ${model.careerPacket.readiness.estimatedStartDays} day(s)`
              : ''}
          </Text>
          {model.careerPacket.readiness.blockers.map((blocker) => (
            <Text key={blocker} style={[styles.sectionCopy, { marginTop: 4 }]}>• {blocker}</Text>
          ))}
        </View>

        {model.careerPacket.missingEvidence.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Missing Evidence</Text>
            {model.careerPacket.missingEvidence.map((item, index) => (
              <Text key={`${item.label}-${index}`} style={[styles.sectionCopy, { marginTop: 3 }]}>
                • {item.label} — {item.stateLabel}
              </Text>
            ))}
          </View>
        )}

        {model.careerPacket.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {model.careerPacket.recommendations.map((rec, index) => (
              <Text key={`${rec.title}-${index}`} style={[styles.sectionCopy, { marginTop: 3 }]}>
                • {rec.title}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          Source-backed by VitalCV - Audit Log: {model.packetHash}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderEmployerProofPacketPdf(passport: PassportData): Promise<Buffer> {
  const model = buildEmployerProofPacketPdfModel(passport);
  return renderToBuffer(<EmployerProofPacketDocument model={model} />);
}
