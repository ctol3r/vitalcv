import type { MarketEquilibrium } from './market';
import type { MultiSignalResult } from './engine-v5';
import type { SkillGapRecommendation } from './skills-gap';

export interface MatchHighlight {
  title: string;
  detail: string;
  sentiment: 'positive' | 'neutral' | 'warning';
}

export interface MatchExplanation {
  summary: string;
  highlights: MatchHighlight[];
  recommendedActions: Array<{
    label: string;
    detail: string;
  }>;
}

interface ExplanationInput {
  roleTitle: string;
  market: MarketEquilibrium;
  multiSignal: MultiSignalResult;
  gaps: SkillGapRecommendation[];
  fairnessAlerts?: string[];
}

export function buildMatchExplanation(input: ExplanationInput): MatchExplanation {
  const summary = buildSummary(input);
  const highlights = buildHighlights(input);
  const recommendedActions = buildActions(input);

  return {
    summary,
    highlights,
    recommendedActions,
  };
}

function buildSummary(input: ExplanationInput): string {
  const score = (input.multiSignal.finalScore * 100).toFixed(1);
  const pressure = input.market.pressure;
  const pressureText =
    pressure === 'tight'
      ? 'competitive demand signal'
      : pressure === 'surplus'
        ? 'low-risk supply region'
        : 'balanced regional demand';
  return `${score}% suitability for ${input.roleTitle} with ${pressureText}.`;
}

function buildHighlights(input: ExplanationInput): MatchHighlight[] {
  const highlights: MatchHighlight[] = [];
  const skillComponent = input.multiSignal.components.skill;
  const readinessComponent = input.multiSignal.components.readiness;
  const ehrComponent = input.multiSignal.components.ehr;

  highlights.push({
    title: 'Skill alignment',
    detail:
      skillComponent >= 0.85
        ? 'Primary specialty matches job taxonomy with high procedure overlap.'
        : 'Specialty overlap partial — adjacent experience detected.',
    sentiment: skillComponent >= 0.85 ? 'positive' : 'neutral',
  });

  highlights.push({
    title: 'Readiness posture',
    detail:
      readinessComponent >= 0.8
        ? 'Readiness telemetry is deployable with current PSV cadence.'
        : 'Readiness gaps exist — refresh PSV before credential committee.',
    sentiment: readinessComponent >= 0.8 ? 'positive' : 'warning',
  });

  if (input.market.pressure === 'tight') {
    highlights.push({
      title: 'Market pressure',
      detail: 'High demand outpaces supply in this region — act quickly on offers.',
      sentiment: 'warning',
    });
  } else if (input.market.pressure === 'surplus') {
    highlights.push({
      title: 'Market pressure',
      detail: 'Supply surplus — leverage negotiation advantages.',
      sentiment: 'positive',
    });
  } else {
    highlights.push({
      title: 'Market pressure',
      detail: 'Balanced supply/demand window.',
      sentiment: 'neutral',
    });
  }

  if (ehrComponent < 0.7) {
    highlights.push({
      title: 'EHR Privileges',
      detail: input.multiSignal.metadata.blockers.length
        ? `Need privilege evidence for ${input.multiSignal.metadata.blockers.join(', ')}`
        : 'EHR privilege inventory incomplete.',
      sentiment: 'warning',
    });
  }

  if (input.fairnessAlerts?.length) {
    highlights.push({
      title: 'Fairness guardrail',
      detail: `${input.fairnessAlerts.length} bias alerts require recruiter acknowledgement.`,
      sentiment: 'warning',
    });
  }

  return highlights;
}

function buildActions(input: ExplanationInput) {
  const actions: Array<{ label: string; detail: string }> = [];
  input.gaps.forEach((gap) => {
    actions.push({
      label: gap.title,
      detail: gap.detail,
    });
  });

  if (!actions.length && input.multiSignal.finalScore < 0.8) {
    actions.push({
      label: 'Boost readiness',
      detail: 'Upload recent PSV packet to push score above 80%',
    });
  }

  return actions.slice(0, 4);
}


