import type { GraphProjection } from '../types';
import { uniqueSorted } from '../utils';
import {
  createOntologyEntity,
  createOntologyGraph,
  createOntologyRelation,
  toOntologyProjection,
  type OntologyGraph,
} from '../ontology';

export const PROVIDER_GRAPH_RELATION_TYPES = [
  'taxonomy_to_provider',
  'state_to_provider',
  'provider_to_trust_state',
] as const;

export type ProviderGraphRelationType = (typeof PROVIDER_GRAPH_RELATION_TYPES)[number];

export interface ProviderGraphTaxonomy {
  code: string;
  label?: string;
  primary?: boolean;
}

export interface ProviderGraphTrustState {
  band: string;
  score: number;
  startReady: boolean;
  auditRef?: string;
  lastVerifiedAt?: string;
  blockingReasons?: readonly string[];
  metadata?: Record<string, unknown>;
}

export interface ProviderGraphProviderInput {
  npi: string;
  label?: string;
  taxonomies: readonly ProviderGraphTaxonomy[];
  states: readonly string[];
  trustState: ProviderGraphTrustState;
  metadata?: Record<string, unknown>;
}

export interface StructuredProviderGraphInput {
  createdAt?: string;
  graphId?: string;
  version?: string;
  providers: readonly ProviderGraphProviderInput[];
}

function normalizeNpi(npi: string): string {
  const normalized = npi.trim();
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error(`Invalid provider NPI: ${npi}`);
  }
  return normalized;
}

function normalizeState(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new Error('State is required for provider graph');
  }
  return normalized;
}

function normalizeTaxonomyCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new Error('Taxonomy code is required for provider graph');
  }
  return normalized;
}

function providerNodeId(npi: string): string {
  return `provider:npi:${npi}`;
}

function taxonomyNodeId(code: string): string {
  return `taxonomy:${code.toLowerCase()}`;
}

function stateNodeId(state: string): string {
  return `state:${state}`;
}

function trustStateNodeId(npi: string): string {
  return `trust_state:npi:${npi}`;
}

function trustStateLabel(trustState: ProviderGraphTrustState): string {
  return `${trustState.band} (${trustState.score})`;
}

function providerLabel(npi: string, label?: string): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Provider ${npi}`;
}

function normalizeTrustState(trustState: ProviderGraphTrustState): ProviderGraphTrustState {
  const band = trustState.band.trim();
  if (band.length === 0) {
    throw new Error('trustState.band is required for provider graph');
  }
  if (!Number.isFinite(trustState.score)) {
    throw new Error('trustState.score must be a finite number for provider graph');
  }
  if (typeof trustState.startReady !== 'boolean') {
    throw new Error('trustState.startReady must be boolean for provider graph');
  }

  return {
    ...trustState,
    band,
    score: trustState.score,
    startReady: trustState.startReady,
    blockingReasons: [...(trustState.blockingReasons ?? [])],
    metadata: trustState.metadata ?? {},
  };
}

export function createStructuredProviderGraph(input: StructuredProviderGraphInput): OntologyGraph {
  const entities = new Map<string, ReturnType<typeof createOntologyEntity>>();
  const relations = new Map<string, ReturnType<typeof createOntologyRelation>>();

  for (const provider of input.providers) {
    if (!provider.trustState) {
      throw new Error(`trustState is required for provider ${provider.npi}`);
    }

    const npi = normalizeNpi(provider.npi);
    const trustState = normalizeTrustState(provider.trustState);
    const providerId = providerNodeId(npi);
    const label = providerLabel(npi, provider.label);
    const taxonomyCodes = uniqueSorted(
      provider.taxonomies.map((taxonomy) => normalizeTaxonomyCode(taxonomy.code)),
    );
    const states = uniqueSorted(provider.states.map(normalizeState));

    entities.set(
      providerId,
      createOntologyEntity({
        entityId: providerId,
        entityType: 'provider',
        label,
        metadata: {
          npi,
          taxonomyCodes,
          states,
          trustStateBand: trustState.band,
          trustStateScore: trustState.score,
          ...provider.metadata,
        },
      }),
    );

    for (const taxonomy of provider.taxonomies) {
      const code = normalizeTaxonomyCode(taxonomy.code);
      const taxonomyId = taxonomyNodeId(code);
      if (!entities.has(taxonomyId)) {
        entities.set(
          taxonomyId,
          createOntologyEntity({
            entityId: taxonomyId,
            entityType: 'taxonomy',
            label: taxonomy.label?.trim() || code,
            metadata: {
              code,
              label: taxonomy.label?.trim() || code,
            },
          }),
        );
      }

      relations.set(
        `${taxonomyId}->${providerId}:taxonomy`,
        createOntologyRelation({
          sourceEntityId: taxonomyId,
          targetEntityId: providerId,
          relationType: 'taxonomy_to_provider',
          directed: true,
          metadata: {
            code,
            primary: Boolean(taxonomy.primary),
          },
        }),
      );
    }

    for (const state of states) {
      const stateId = stateNodeId(state);
      if (!entities.has(stateId)) {
        entities.set(
          stateId,
          createOntologyEntity({
            entityId: stateId,
            entityType: 'state',
            label: state,
            metadata: {
              code: state,
            },
          }),
        );
      }

      relations.set(
        `${stateId}->${providerId}:state`,
        createOntologyRelation({
          sourceEntityId: stateId,
          targetEntityId: providerId,
          relationType: 'state_to_provider',
          directed: true,
          metadata: {
            code: state,
          },
        }),
      );
    }

    const trustStateId = trustStateNodeId(npi);
    entities.set(
      trustStateId,
      createOntologyEntity({
        entityId: trustStateId,
        entityType: 'trust_state',
        label: trustStateLabel(trustState),
        metadata: {
          npi,
          band: trustState.band,
          score: trustState.score,
          startReady: trustState.startReady,
          auditRef: trustState.auditRef ?? null,
          lastVerifiedAt: trustState.lastVerifiedAt ?? null,
          blockingReasons: trustState.blockingReasons,
          firstClass: true,
          ...trustState.metadata,
        },
      }),
    );

    relations.set(
      `${providerId}->${trustStateId}:trust-state`,
      createOntologyRelation({
        sourceEntityId: providerId,
        targetEntityId: trustStateId,
        relationType: 'provider_to_trust_state',
        directed: true,
        metadata: {
          band: trustState.band,
          score: trustState.score,
          startReady: trustState.startReady,
        },
      }),
    );
  }

  return createOntologyGraph({
    graphId: input.graphId,
    version: input.version ?? 'c56.3',
    createdAt: input.createdAt,
    entities: [...entities.values()],
    relations: [...relations.values()],
  });
}

export function projectStructuredProviderGraph(
  input: StructuredProviderGraphInput,
): GraphProjection {
  return toOntologyProjection(createStructuredProviderGraph(input));
}
