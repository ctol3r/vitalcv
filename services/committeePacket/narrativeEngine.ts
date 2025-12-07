import * as crypto from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';
import { explainLicensureAndBoardSection } from './explainLicensureBoard';
import { explainPayerSection } from './explainPayer';
import { explainQualitySection } from './explainQuality';
import { explainRiskSection } from './explainRisk';
import {
  CommitteeNarrative,
  CommitteePacketData,
  NarrativeEngineOptions,
  SectionNarrative,
} from './narrativeTypes';
import {
  DEFAULT_HIGHLIGHT_LIMIT,
  dedupeStrings,
  formatDate,
  inferRiskTier,
  limitList,
  severityWeight,
} from './utils';

const log = getServiceLogger('committeePacket/narrativeEngine');

export async function generateCommitteeNarrative(
  packet: CommitteePacketData,
  options?: NarrativeEngineOptions
): Promise<CommitteeNarrative> {
  const highlightLimit = options?.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const deterministic =
    options?.deterministic ?? process.env.COMMITTEE_PACKET_MODE === 'deterministic';
  const clock = options?.clock ?? (() => new Date());

  const sections = {
    risk: explainRiskSection(packet.risk, { ...options, deterministic, highlightLimit }),
    quality: explainQualitySection(packet.quality, { ...options, deterministic, highlightLimit }),
    licensure: explainLicensureAndBoardSection(packet.licensure, {
      ...options,
      deterministic,
      highlightLimit,
    }),
    payer: explainPayerSection(packet.payer, { ...options, deterministic, highlightLimit }),
  };

  const overview = buildOverview(packet, sections);
  const highlightPool = dedupeStrings([
    ...sections.risk.highlights,
    ...sections.quality.highlights,
    ...sections.licensure.highlights,
    ...sections.payer.highlights,
  ]).filter(Boolean);
  const highlights = limitList(highlightPool, highlightLimit);

  const concerns = dedupeStrings([
    ...sections.risk.concerns,
    ...sections.quality.concerns,
    ...sections.licensure.concerns,
    ...sections.payer.concerns,
  ]).filter(Boolean);

  const recommendation = deriveRecommendation(packet, sections, concerns);

  const includePrompt = options?.includePrompt ?? true;
  const prompt = includePrompt
    ? buildPrompt(packet, sections, highlights, concerns, recommendation)
    : undefined;

  let llmDraft: string | undefined;
  if (options?.llmClient && !deterministic) {
    try {
      llmDraft = await options.llmClient.complete({
        prompt: prompt ?? buildPrompt(packet, sections, highlights, concerns, recommendation),
        context: {
          clinicianId: packet.clinician.id,
          packetId: packet.cycle.packetId,
          sections,
        },
      });
    } catch (error) {
      log.error(
        { err: error, model: options.llmClient.name, packetId: packet.cycle.packetId },
        'LLM narrative generation failed'
      );
    }
  }

  const promptHash =
    prompt || llmDraft
      ? crypto
          .createHash('sha256')
          .update(prompt ?? llmDraft ?? '')
          .digest('hex')
          .slice(0, 16)
      : '';

  return {
    overview,
    highlights,
    concerns,
    recommendation,
    sections,
    metadata: {
      deterministic,
      generatedAt: clock().toISOString(),
      clinicianId: packet.clinician.id,
      highlightLimit,
      promptHash,
      llmModel: options?.llmClient?.name,
    },
    prompt,
    llmDraft,
  };
}

function buildOverview(
  packet: CommitteePacketData,
  sections: Record<'risk' | 'quality' | 'licensure' | 'payer', SectionNarrative>
): string {
  const { clinician, cycle, risk } = packet;
  const coverage =
    cycle.coveragePeriod?.start && cycle.coveragePeriod?.end
      ? `${formatDate(cycle.coveragePeriod.start)} → ${formatDate(cycle.coveragePeriod.end)}`
      : 'coverage period n/a';
  const riskTier = risk ? risk.tier ?? inferRiskTier(risk.score) : 'low';
  return `${clinician.name}${clinician.specialty ? ` (${clinician.specialty})` : ''} • Packet ${
    cycle.packetId
  } • ${coverage} • Risk ${riskTier}. Highlight confidence – risk ${sections.risk.confidence}, quality ${sections.quality.confidence}, licensure ${sections.licensure.confidence}, payer ${sections.payer.confidence}.`;
}

function deriveRecommendation(
  packet: CommitteePacketData,
  sections: Record<'risk' | 'quality' | 'licensure' | 'payer', SectionNarrative>,
  concerns: string[]
): string {
  const riskTier = packet.risk ? packet.risk.tier ?? inferRiskTier(packet.risk.score) : 'low';
  const evidence = [
    ...sections.risk.evidence,
    ...sections.quality.evidence,
    ...sections.licensure.evidence,
    ...sections.payer.evidence,
  ];

  const hasCritical = evidence.some(
    (point) => severityWeight(point.severity) >= severityWeight('critical')
  );
  const hasHigh = evidence.some((point) => severityWeight(point.severity) >= severityWeight('high'));

  if (hasCritical) {
    return 'Defer renewal – escalate to committee chair for remediation plan.';
  }

  if (riskTier === 'high' || hasHigh || concerns.length > 3) {
    return 'Renewal with conditions – require mitigation plan and 90-day follow-up.';
  }

  if (riskTier === 'moderate' || concerns.length > 0) {
    return 'Conditional renewal – monitor flagged items through next OPPE cycle.';
  }

  return 'Approve renewal – no blocking issues detected.';
}

function buildPrompt(
  packet: CommitteePacketData,
  sections: Record<'risk' | 'quality' | 'licensure' | 'payer', SectionNarrative>,
  highlights: string[],
  concerns: string[],
  recommendation: string
): string {
  const lines: string[] = [
    'You are drafting a credentialing committee narrative. Use only the provided data.',
    '',
    `Clinician: ${packet.clinician.name} (${packet.clinician.specialty ?? 'Specialty n/a'})`,
    `Packet: ${packet.cycle.packetId}`,
  ];

  if (packet.cycle.coveragePeriod) {
    lines.push(
      `Coverage: ${formatDate(packet.cycle.coveragePeriod.start)} → ${formatDate(
        packet.cycle.coveragePeriod.end
      )}`
    );
  }

  if (packet.cycle.meetingDate) {
    lines.push(`Committee meeting date: ${formatDate(packet.cycle.meetingDate)}`);
  }

  lines.push('', 'Section summaries:');
  lines.push(`Risk: ${sections.risk.summary}`);
  lines.push(`Quality: ${sections.quality.summary}`);
  lines.push(`Licensure & Board: ${sections.licensure.summary}`);
  lines.push(`Payer: ${sections.payer.summary}`);

  lines.push('', 'Highlights:');
  lines.push(...(highlights.length ? highlights : ['None noted']));

  lines.push('', 'Concerns:');
  lines.push(...(concerns.length ? concerns : ['None noted']));

  lines.push('', `Recommended disposition: ${recommendation}`);
  lines.push('', 'Output JSON with keys: overview, highlights, concerns, recommendation.');

  return lines.join('\n');
}


