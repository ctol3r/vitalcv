/**
 * B197B-SAFETY-007: RestrictionEngine
 *
 * Evaluates safety signals in the context of the privilege dependency graph
 * and produces state transitions for individual privilege codes.
 */

import {
  PrismaClient,
  PrivilegeDependencyType,
  PrivilegeSafetyStateValue,
  SafetySignalSeverity,
} from '@prisma/client';
import { PrivilegeGraph, PrivilegeGraphBuilder } from '../privyDep/buildGraph';
import { normalizePrivilegeCode } from '../privyDep/models/PrivilegeNode';
import { PrivilegeDependency } from '../privyDep/models/PrivilegeDependency';
import {
  CascadeScopeEntry,
  SafetySignalDescriptor,
  appendCascadeScope,
  compareSignalSeverity,
  compareStateSeverity,
  mapSeverityToState,
  mergeSignalIds,
} from './models/PrivilegeSafetyState';

export interface RestrictionDecision {
  privilegeCode: string;
  state: PrivilegeSafetyStateValue;
  severity: SafetySignalSeverity;
  reasonCode: string;
  source: string;
  signalIds: string[];
  cascadeScope?: CascadeScopeEntry[];
  metadata?: Record<string, unknown>;
  originPrivilegeCode?: string;
  triggeredBy: 'DIRECT' | 'CASCADE' | 'CONFLICT';
}

export interface RestrictionEngineOptions {
  severityToState?: Partial<Record<SafetySignalSeverity, PrivilegeSafetyStateValue>>;
  conflictDowngradeState?: PrivilegeSafetyStateValue;
}

export interface RestrictionEngineEvaluateInput {
  graph: PrivilegeGraph;
  signals: SafetySignalDescriptor[];
  existingStates?: Record<string, PrivilegeSafetyStateValue>;
  severityOverrides?: Partial<Record<SafetySignalSeverity, PrivilegeSafetyStateValue>>;
}

interface PrivilegeIntent extends RestrictionDecision {
  metadata?: Record<string, unknown>;
}

export class RestrictionEngine {
  private readonly conflictState: PrivilegeSafetyStateValue;

  constructor(private readonly options: RestrictionEngineOptions = {}) {
    this.conflictState = options.conflictDowngradeState ?? PrivilegeSafetyStateValue.PENDING_REVIEW;
  }

  evaluate(input: RestrictionEngineEvaluateInput): RestrictionDecision[] {
    const intents = new Map<string, PrivilegeIntent>();
    const existing = this.normalizeExistingStates(input.existingStates);
    const conflictAdjacency = this.buildConflictAdjacency(input.graph.dependencies);
    const severityOverrides = input.severityOverrides ?? this.options.severityToState;

    for (const signal of input.signals) {
      const stateForSignal = mapSeverityToState(signal.severity, severityOverrides);
      if (stateForSignal === PrivilegeSafetyStateValue.FULL) {
        continue;
      }

      for (const rawCode of signal.privilegeCodes) {
        const privilegeCode = normalizePrivilegeCode(rawCode);
        const intent: PrivilegeIntent = {
          privilegeCode,
          state: stateForSignal,
          severity: signal.severity,
          reasonCode: signal.reasonCode,
          source: signal.source,
          signalIds: [signal.id],
          metadata: signal.metadata ?? (signal.summary ? { summary: signal.summary } : undefined),
          triggeredBy: 'DIRECT',
        };
        this.mergeIntent(intents, intent);
        this.propagateRequires(input.graph, intent, intents);
        this.propagateConflicts(conflictAdjacency, intent, intents);
      }
    }

    const decisions = Array.from(intents.values()).filter((intent) => {
      const currentState = existing[intent.privilegeCode] ?? PrivilegeSafetyStateValue.FULL;
      return compareStateSeverity(intent.state, currentState) > 0;
    });

    decisions.sort((a, b) => {
      const severityCompare = compareStateSeverity(b.state, a.state);
      if (severityCompare !== 0) {
        return severityCompare;
      }
      return compareSignalSeverity(b.severity, a.severity);
    });

    return decisions;
  }

  private normalizeExistingStates(
    existing?: Record<string, PrivilegeSafetyStateValue>,
  ): Record<string, PrivilegeSafetyStateValue> {
    if (!existing) {
      return {};
    }
    return Object.entries(existing).reduce<Record<string, PrivilegeSafetyStateValue>>(
      (acc, [code, state]) => {
        acc[normalizePrivilegeCode(code)] = state;
        return acc;
      },
      {},
    );
  }

  private mergeIntent(store: Map<string, PrivilegeIntent>, next: PrivilegeIntent) {
    const key = normalizePrivilegeCode(next.privilegeCode);
    const existing = store.get(key);

    if (!existing) {
      store.set(key, {
        ...next,
        privilegeCode: key,
        signalIds: Array.from(new Set(next.signalIds)),
        cascadeScope: next.cascadeScope ? [...next.cascadeScope] : undefined,
        metadata: next.metadata ? { ...next.metadata } : undefined,
      });
      return;
    }

    const stateComparison = compareStateSeverity(next.state, existing.state);
    const severityComparison = compareSignalSeverity(next.severity, existing.severity);

    if (stateComparison > 0 || (stateComparison === 0 && severityComparison > 0)) {
      store.set(key, {
        ...existing,
        ...next,
        privilegeCode: key,
        signalIds: mergeSignalIds(existing.signalIds, next.signalIds),
        cascadeScope: appendCascadeScope(next.cascadeScope, existing.cascadeScope),
        metadata: { ...(existing.metadata ?? {}), ...(next.metadata ?? {}) },
      });
      return;
    }

    existing.signalIds = mergeSignalIds(existing.signalIds, next.signalIds);
    existing.cascadeScope = appendCascadeScope(existing.cascadeScope, next.cascadeScope);
    existing.metadata = { ...(existing.metadata ?? {}), ...(next.metadata ?? {}) };
  }

  private propagateRequires(
    graph: PrivilegeGraph,
    originIntent: PrivilegeIntent,
    store: Map<string, PrivilegeIntent>,
  ) {
    const queue: Array<{ code: string; path: string[] }> = [{ code: originIntent.privilegeCode, path: [originIntent.privilegeCode] }];
    const visited = new Set<string>([originIntent.privilegeCode]);

    while (queue.length > 0) {
      const { code, path } = queue.shift()!;
      const edges = graph.adjacency[code] ?? [];

      for (const edge of edges) {
        if (edge.dependencyType !== PrivilegeDependencyType.REQUIRES) {
          continue;
        }
        const childCode = edge.code;
        if (visited.has(childCode)) {
          continue;
        }
        visited.add(childCode);
        const scopeEntry: CascadeScopeEntry = {
          originPrivilegeCode: originIntent.privilegeCode,
          dependencyType: PrivilegeDependencyType.REQUIRES,
          path: [...path, childCode],
        };
        const cascadeIntent: PrivilegeIntent = {
          privilegeCode: childCode,
          state: originIntent.state,
          severity: originIntent.severity,
          reasonCode: `${originIntent.reasonCode}:CASCADE:${edge.dependencyType}`,
          source: originIntent.source,
          signalIds: [...originIntent.signalIds],
          cascadeScope: [scopeEntry],
          metadata: originIntent.metadata,
          triggeredBy: 'CASCADE',
          originPrivilegeCode: originIntent.privilegeCode,
        };
        this.mergeIntent(store, cascadeIntent);
        queue.push({ code: childCode, path: scopeEntry.path });
      }
    }
  }

  private propagateConflicts(
    conflicts: Record<string, string[]>,
    originIntent: PrivilegeIntent,
    store: Map<string, PrivilegeIntent>,
  ) {
    const peers = conflicts[originIntent.privilegeCode];
    if (!peers || peers.length === 0) {
      return;
    }
    if (this.conflictState === PrivilegeSafetyStateValue.FULL) {
      return;
    }

    for (const peer of peers) {
      if (peer === originIntent.privilegeCode) {
        continue;
      }
      const conflictIntent: PrivilegeIntent = {
        privilegeCode: peer,
        state: this.conflictState,
        severity: originIntent.severity,
        reasonCode: `${originIntent.reasonCode}:CONFLICT`,
        source: originIntent.source,
        signalIds: [...originIntent.signalIds],
        cascadeScope: [
          {
            originPrivilegeCode: originIntent.privilegeCode,
            dependencyType: 'CONFLICT',
            path: [originIntent.privilegeCode, peer],
          },
        ],
        metadata: originIntent.metadata,
        triggeredBy: 'CONFLICT',
        originPrivilegeCode: originIntent.privilegeCode,
      };
      this.mergeIntent(store, conflictIntent);
    }
  }

  private buildConflictAdjacency(dependencies: PrivilegeDependency[]): Record<string, string[]> {
    const adjacency: Record<string, string[]> = {};
    for (const edge of dependencies) {
      if (
        edge.dependencyType !== PrivilegeDependencyType.MUTUALLY_EXCLUSIVE &&
        edge.dependencyType !== PrivilegeDependencyType.CONFLICTS_WITH
      ) {
        continue;
      }
      const parent = normalizePrivilegeCode(edge.parentPrivilegeCode);
      const child = normalizePrivilegeCode(edge.childPrivilegeCode);
      adjacency[parent] = adjacency[parent] ?? [];
      adjacency[child] = adjacency[child] ?? [];
      adjacency[parent].push(child);
      adjacency[child].push(parent);
    }
    return adjacency;
  }
}

export async function loadPrivilegeGraph(client: PrismaClient): Promise<PrivilegeGraph> {
  const [nodes, dependencies] = await Promise.all([
    client.privilegeNode.findMany(),
    client.privilegeDependency.findMany(),
  ]);

  const builder = new PrivilegeGraphBuilder(
    nodes.map((node) => ({
      ...node,
      privilegeCode: normalizePrivilegeCode(node.privilegeCode),
    })),
    dependencies.map((edge) => ({
      ...edge,
      parentPrivilegeCode: normalizePrivilegeCode(edge.parentPrivilegeCode),
      childPrivilegeCode: normalizePrivilegeCode(edge.childPrivilegeCode),
    })),
  );

  return builder.build();
}

export async function fetchActiveSafetyStateMap(
  client: PrismaClient,
  clinicianId: string,
  privilegeCodes?: string[],
): Promise<Record<string, PrivilegeSafetyStateValue>> {
  const normalizedCodes = privilegeCodes?.map((code) => normalizePrivilegeCode(code));
  const states = await client.privilegeSafetyState.findMany({
    where: {
      clinicianId,
      resolvedAt: null,
      ...(normalizedCodes ? { privilegeCode: { in: normalizedCodes } } : {}),
    },
    orderBy: { effectiveAt: 'desc' },
  });

  const map: Record<string, PrivilegeSafetyStateValue> = {};
  for (const state of states) {
    const code = normalizePrivilegeCode(state.privilegeCode);
    if (!map[code]) {
      map[code] = state.state;
    }
  }
  return map;
}

