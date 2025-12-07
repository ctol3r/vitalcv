import { createHash } from 'crypto';
import type { NormalizedTimelineEvent } from './normalization';
import type { InferredMilestone } from './milestone-inference';
import type { PredictedMilestone } from './milestone-generator';
import type { ComplianceCheckResult } from './compliance-checker';
import type { Discrepancy } from './discrepancy-detector';

export interface TimelineAuditPack {
  clinicianId: string;
  timeline: {
    events: NormalizedTimelineEvent[];
    milestones: InferredMilestone[];
    predicted: PredictedMilestone[];
  };
  compliance: ComplianceCheckResult;
  discrepancies: Discrepancy[];
  generatedAt: string;
  packHash: string;
}

/**
 * Generate timeline audit pack for PDF + VC export
 */
export function generateTimelineAuditPack(
  clinicianId: string,
  events: NormalizedTimelineEvent[],
  milestones: InferredMilestone[],
  predicted: PredictedMilestone[],
  compliance: ComplianceCheckResult,
  discrepancies: Discrepancy[],
): TimelineAuditPack {
  const pack = {
    clinicianId,
    timeline: {
      events,
      milestones,
      predicted,
    },
    compliance,
    discrepancies,
    generatedAt: new Date().toISOString(),
    packHash: '',
  };

  // Generate hash for the pack
  const packHash = createHash('sha256')
    .update(JSON.stringify(pack))
    .digest('hex');

  return {
    ...pack,
    packHash,
  };
}

/**
 * Format timeline for PDF export
 */
export function formatTimelineForPDF(pack: TimelineAuditPack): string {
  let pdfContent = `Experience Timeline Audit Report\n`;
  pdfContent += `Clinician ID: ${pack.clinicianId}\n`;
  pdfContent += `Generated: ${pack.generatedAt}\n\n`;

  pdfContent += `=== Timeline Events ===\n\n`;
  for (const event of pack.timeline.events) {
    pdfContent += `${event.normalizedTitle}\n`;
    pdfContent += `  Type: ${event.normalizedType}\n`;
    pdfContent += `  Start: ${event.normalizedDates.start}\n`;
    if (event.normalizedDates.end) {
      pdfContent += `  End: ${event.normalizedDates.end}\n`;
    }
    if (event.organization) {
      pdfContent += `  Organization: ${event.organization}\n`;
    }
    pdfContent += `  Confidence: ${(event.confidence * 100).toFixed(1)}%\n\n`;
  }

  pdfContent += `=== Inferred Milestones ===\n\n`;
  for (const milestone of pack.timeline.milestones) {
    pdfContent += `${milestone.title}\n`;
    pdfContent += `  Type: ${milestone.type}\n`;
    pdfContent += `  Start: ${milestone.startDate}\n`;
    if (milestone.endDate) {
      pdfContent += `  End: ${milestone.endDate}\n`;
    }
    pdfContent += `  Confidence: ${(milestone.confidence * 100).toFixed(1)}%\n\n`;
  }

  pdfContent += `=== Compliance Check ===\n\n`;
  pdfContent += `Compliant: ${pack.compliance.compliant ? 'Yes' : 'No'}\n`;
  pdfContent += `Score: ${pack.compliance.score}/100\n`;
  pdfContent += `Issues: ${pack.compliance.issues.length}\n\n`;

  if (pack.discrepancies.length > 0) {
    pdfContent += `=== Discrepancies ===\n\n`;
    for (const discrepancy of pack.discrepancies) {
      pdfContent += `${discrepancy.description}\n`;
      pdfContent += `  Severity: ${discrepancy.severity}\n`;
      pdfContent += `  Type: ${discrepancy.type}\n\n`;
    }
  }

  return pdfContent;
}

/**
 * Format timeline for VC (Verifiable Credential) export
 */
export function formatTimelineForVC(pack: TimelineAuditPack): Record<string, unknown> {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'ExperienceTimelineAudit'],
    issuer: {
      id: 'did:web:vitalcv.com',
    },
    issuanceDate: pack.generatedAt,
    credentialSubject: {
      id: `did:clinician:${pack.clinicianId}`,
      timeline: {
        events: pack.timeline.events.map((e) => ({
          type: e.normalizedType,
          title: e.normalizedTitle,
          startDate: e.normalizedDates.start,
          endDate: e.normalizedDates.end,
          organization: e.organization,
        })),
        milestones: pack.timeline.milestones.map((m) => ({
          type: m.type,
          title: m.title,
          startDate: m.startDate,
          endDate: m.endDate,
        })),
      },
      compliance: {
        compliant: pack.compliance.compliant,
        score: pack.compliance.score,
        issueCount: pack.compliance.issues.length,
      },
      discrepancyCount: pack.discrepancies.length,
      packHash: pack.packHash,
    },
  };
}

