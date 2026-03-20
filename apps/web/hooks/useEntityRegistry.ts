'use client';

import { useCallback, useMemo } from 'react';
import type { IntelligenceGraphResponse } from '@/lib/intelligence/contracts';
import type { IntelligenceFinding, IntelligenceProvider, IntelligenceStoryline } from '@/lib/intelligence/contracts';
import {
  EntityRegistry,
  type ExpandedContext,
  type TooltipEntityContext,
} from '@/lib/intelligence/entity-registry';

export interface UseEntityRegistryOptions {
  providers: IntelligenceProvider[];
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  graph: IntelligenceGraphResponse | null;
}

export interface UseEntityRegistryResult {
  registry: EntityRegistry;
  expandFinding: (findingId: string) => ExpandedContext | null;
  expandProvider: (npi: string) => ExpandedContext | null;
  expandStoryline: (storylineId: string) => ExpandedContext | null;
  expandGraphNode: (graphNodeId: string) => ExpandedContext | null;
  getTooltipContext: (graphNodeId: string) => TooltipEntityContext | null;
}

export function useEntityRegistry({
  providers,
  findings,
  storylines,
  graph,
}: UseEntityRegistryOptions): UseEntityRegistryResult {
  const registry = useMemo(
    () => EntityRegistry.build({
      providers,
      findings,
      storylines,
      graphNodes: graph?.nodes ?? [],
      graphEdges: graph?.edges ?? [],
    }),
    [providers, findings, storylines, graph],
  );

  const expandFinding = useCallback(
    (findingId: string) => {
      const entity = registry.entityForFinding(findingId);
      return entity ? registry.expandContext(entity.id) : null;
    },
    [registry],
  );

  const expandProvider = useCallback(
    (npi: string) => {
      const entity = registry.entityForNpi(npi);
      return entity ? registry.expandContext(entity.id) : null;
    },
    [registry],
  );

  const expandStoryline = useCallback(
    (storylineId: string) => {
      const entity = registry.entityForStoryline(storylineId);
      return entity ? registry.expandContext(entity.id) : null;
    },
    [registry],
  );

  const expandGraphNode = useCallback(
    (graphNodeId: string) => {
      const entity = registry.entityForGraphNode(graphNodeId);
      return entity ? registry.expandContext(entity.id) : null;
    },
    [registry],
  );

  const getTooltipContext = useCallback(
    (graphNodeId: string) => registry.getTooltipContext(graphNodeId),
    [registry],
  );

  return {
    registry,
    expandFinding,
    expandProvider,
    expandStoryline,
    expandGraphNode,
    getTooltipContext,
  };
}
