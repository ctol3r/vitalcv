import type { FeatureContext, FeatureVector } from './features';
import type { EhrPrivilegeSignal } from './engine-v5';

export type SkillGapRecommendationType = 'cme' | 'certification' | 'compact';

export interface SkillGapRecommendation {
  id: string;
  type: SkillGapRecommendationType;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
}

interface SkillGapInput {
  featureVector: FeatureVector;
  context: FeatureContext;
  ehr: EhrPrivilegeSignal;
  limit?: number;
}

const MAX_RECOMMENDATIONS = 4;

export function buildSkillGapRecommendations(input: SkillGapInput): SkillGapRecommendation[] {
  const recommendations: SkillGapRecommendation[] = [];
  const limit = input.limit ?? MAX_RECOMMENDATIONS;

  if (input.featureVector.boardStatus < 0.8) {
    recommendations.push(
      buildRecommendation('certification', 'Renew specialty board credential', {
        detail: `Board certification for ${input.context.job.specialty} is below payer-ready threshold.`,
        priority: input.featureVector.boardStatus < 0.6 ? 'high' : 'medium',
      }),
    );
  }

  if (input.featureVector.compactFit < 0.7) {
    recommendations.push(
      buildRecommendation('compact', 'File compact privilege packet', {
        detail: 'Increase telehealth + surge eligibility with a single compact submission.',
        priority: input.featureVector.compactFit < 0.5 ? 'high' : 'medium',
      }),
    );
  }

  if (input.featureVector.experience < 0.75 || input.featureVector.specialtyMatch < 0.8) {
    recommendations.push(
      buildRecommendation('cme', `Targeted CME: ${input.context.job.specialty}`, {
        detail: 'Refresh procedure logs to raise multi-signal competency confidence.',
        priority:
          input.featureVector.specialtyMatch < 0.65 || input.featureVector.experience < 0.6
            ? 'high'
            : 'medium',
      }),
    );
  }

  if (input.ehr.requiredRoles.length && input.ehr.blockers.length) {
    recommendations.push(
      buildRecommendation('certification', 'Provision EHR privilege evidence', {
        detail: `Missing EHR roles: ${input.ehr.blockers.join(', ')}`,
        priority: 'high',
      }),
    );
  }

  return recommendations.slice(0, limit);
}

function buildRecommendation(
  type: SkillGapRecommendationType,
  title: string,
  options: { detail: string; priority: SkillGapRecommendation['priority'] },
): SkillGapRecommendation {
  const id = `${type}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return {
    id,
    type,
    title,
    detail: options.detail,
    priority: options.priority,
  };
}


