import type { PractitionerRoleResource } from '../../../../../services/fhir/types/r6';
import {
  jobPostingToPractitionerRole,
  type JobPostingForPractitionerRole,
} from '../../../../../services/fhir/adapter/practitionerRoleAdapter';
import type { MarketEquilibrium } from './market';
import type { MultiSignalResult } from './engine-v5';
import type { MatchExplanation } from './explain';
import type { SkillGapRecommendation } from './skills-gap';

const MATCH_SUITABILITY_URL =
  'https://vitalcv.health/fhir/StructureDefinition/match-suitability';

export interface MatchSuitabilityInput {
  job: {
    id: string;
    title: string | null;
    partnerId: string;
    partnerName?: string | null;
    specialty?: string | null;
    requiredStates?: string[] | null;
    status?: string | null;
    telehealth?: boolean | null;
    modality?: string | null;
    location?: Record<string, unknown> | null;
  };
  clinicianId: string;
  multiSignal: MultiSignalResult;
  market: MarketEquilibrium;
  explanation: MatchExplanation;
  skillGaps: SkillGapRecommendation[];
}

export function buildMatchSuitabilityResource(
  input: MatchSuitabilityInput,
): PractitionerRoleResource {
  const jobInput: JobPostingForPractitionerRole = {
    id: input.job.id,
    title: input.job.title ?? 'Role',
    partnerId: input.job.partnerId,
    partnerName: input.job.partnerName ?? undefined,
    specialty: input.job.specialty ?? 'GENERAL',
    requiredStates: input.job.requiredStates ?? [],
    status: input.job.status as JobPostingForPractitionerRole['status'],
    telehealth: input.job.telehealth ?? undefined,
    modality: input.job.modality ?? undefined,
    location: input.job.location as JobPostingForPractitionerRole['location'],
  };

  const resource = jobPostingToPractitionerRole(jobInput, {
    practitionerId: input.clinicianId,
    organizationId: input.job.partnerId,
  });

  const suitabilityExtension = buildSuitabilityExtension(input);

  return {
    ...resource,
    extension: [...(resource.extension ?? []), suitabilityExtension],
  };
}

function buildSuitabilityExtension(input: MatchSuitabilityInput) {
  return {
    url: MATCH_SUITABILITY_URL,
    extension: [
      {
        url: 'score',
        valueDecimal: Number(input.multiSignal.finalScore.toFixed(4)),
      },
      {
        url: 'components',
        extension: Object.entries(input.multiSignal.components).map(([key, value]) => ({
          url: key,
          valueDecimal: Number(value.toFixed(4)),
        })),
      },
      {
        url: 'market',
        extension: [
          { url: 'pressure', valueString: input.market.pressure },
          { url: 'ratio', valueDecimal: Number(input.market.marketRatio.toFixed(3)) },
          {
            url: 'projectedFillDays',
            valueDecimal: Number(input.market.projectedFillTimeDays.toFixed(0)),
          },
        ],
      },
      {
        url: 'trustWeight',
        valueDecimal: Number(input.multiSignal.metadata.trustWeight.toFixed(4)),
      },
      {
        url: 'summary',
        valueString: input.explanation.summary,
      },
      buildActionExtension(input.skillGaps),
    ],
  };
}

function buildActionExtension(skillGaps: SkillGapRecommendation[]) {
  const actions = skillGaps.slice(0, 3);
  if (!actions.length) {
    return {
      url: 'recommendedAction',
      valueString: 'No remediation required',
    };
  }
  return {
    url: 'recommendedAction',
    extension: actions.map((action) => ({
      url: action.type,
      extension: [
        { url: 'title', valueString: action.title },
        { url: 'detail', valueString: action.detail },
        { url: 'priority', valueString: action.priority },
      ],
    })),
  };
}



