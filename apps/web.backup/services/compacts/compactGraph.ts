import type {
  CompactParticipationIndex,
  CompactParticipationRecord,
  CompactType,
} from './models/CompactParticipation.js';
import {
  CompactParticipationSchema,
  buildParticipationIndex,
  normalizeStateCode,
} from './models/CompactParticipation.js';
import type { CompactParticipationSeedMap } from './data/stateParticipation.js';
import { COMPACT_STATE_PARTICIPATION_SEED_DATA } from './data/stateParticipation.js';
import type { AprnEligibilityResult } from './rules/aprnRules.js';
import { evaluateAprnCompactRules } from './rules/aprnRules.js';

export type CompactStateGraphData = CompactParticipationIndex;

export interface CompactAuthorizationContext {
  graph?: CompactStateGraphData;
  includeHomeState?: boolean;
  residencyState?: string;
  rnLicenseActive?: boolean;
  lastMoveDate?: Date | string;
  asOf?: Date | string;
}

export interface CompactAuthorizationDetail {
  compactType: CompactType;
  homeState: string;
  states: string[];
  participation?: CompactParticipationRecord;
  aprn?: AprnEligibilityResult;
}

export const DEFAULT_STATE_GRAPH = buildStateGraph(COMPACT_STATE_PARTICIPATION_SEED_DATA);

export function buildStateGraph(seedMap: CompactParticipationSeedMap): CompactStateGraphData {
  const records: CompactParticipationRecord[] = [];
  for (const [compactType, seeds] of Object.entries(seedMap) as [CompactType, CompactParticipationSeedMap[CompactType]][]) {
    for (const seed of seeds) {
      const parsed = CompactParticipationSchema.parse({
        compactType,
        state: seed.state,
        status: seed.status,
        startDate: seed.startDate,
        metadata: seed.metadata,
      });
      records.push(parsed);
    }
  }
  return buildParticipationIndex(records);
}

export function getAuthorizedStates(
  compactType: CompactType,
  homeState: string,
  context: CompactAuthorizationContext = {},
): string[] {
  return getAuthorizedStatesDetailed(compactType, homeState, context).states;
}

export function getAuthorizedStatesDetailed(
  compactType: CompactType,
  homeState: string,
  context: CompactAuthorizationContext = {},
): CompactAuthorizationDetail {
  const graph = context.graph ?? DEFAULT_STATE_GRAPH;
  const normalizedHome = normalizeStateCode(homeState);
  const participation = graph[compactType]?.[normalizedHome];

  if (!participation || participation.status !== 'ACTIVE') {
    return { compactType, homeState: normalizedHome, states: [], participation };
  }

  const activeStates = getActiveStates(compactType, graph);
  let states: string[] = [];
  let aprn: AprnEligibilityResult | undefined;

  switch (compactType) {
    case 'IMLC':
      states = activeStates.filter((state) => state !== normalizedHome);
      break;
    case 'PSYPACT':
      states = activeStates;
      break;
    case 'APRN':
      aprn = evaluateAprnCompactRules({
        homeState: normalizedHome,
        residencyState: context.residencyState ?? normalizedHome,
        rnLicenseActive: context.rnLicenseActive ?? true,
        lastMoveDate: context.lastMoveDate,
        asOf: context.asOf,
        participation,
      });
      if (aprn.isEligible && !aprn.needsWaitingPeriod) {
        states = activeStates;
      } else {
        states = [];
      }
      break;
    case 'NLC':
    case 'PT': {
      const includeHome = context.includeHomeState ?? true;
      states = includeHome ? activeStates : activeStates.filter((state) => state !== normalizedHome);
      break;
    }
    default:
      states = activeStates;
  }

  return {
    compactType,
    homeState: normalizedHome,
    states,
    participation,
    aprn,
  };
}

export function getActiveStates(
  compactType: CompactType,
  graph: CompactStateGraphData = DEFAULT_STATE_GRAPH,
): string[] {
  return Object.values(graph[compactType] ?? {})
    .filter((record) => record.status === 'ACTIVE')
    .map((record) => record.state)
    .sort();
}

