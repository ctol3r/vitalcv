/**
 * canonicalSourceAdapters.ts — E0 canonical production adapter registry.
 *
 * One source may have many historical adapters, fixtures and compatibility
 * layers in the repository. Only the identityIngestionPipeline handler named
 * here is allowed to act as the production ingestion entry point.
 *
 * This registry is deliberately separate from sourceCatalog.ts:
 *   sourceCatalog = what the source is and what it may claim
 *   this registry = which implementation is permitted to ingest it
 */

import { IMPLEMENTED_INGEST_SOURCE_IDS } from './sourceCatalog';

export type CanonicalSourceAdapterId = (typeof IMPLEMENTED_INGEST_SOURCE_IDS)[number];

export interface CanonicalSourceAdapterDefinition {
  sourceId: CanonicalSourceAdapterId;
  canonicalEntryPoint: `identityIngestionPipeline.handlers.${CanonicalSourceAdapterId}`;
  requiredEnvironmentVariables: readonly string[];
  deprecatedAlternateModuleFragments: readonly string[];
  notes: string;
}

export const CANONICAL_SOURCE_ADAPTERS: Record<
  CanonicalSourceAdapterId,
  CanonicalSourceAdapterDefinition
> = {
  NPPES_API: {
    sourceId: 'NPPES_API',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.NPPES_API',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [
      'packages/psv-adapters/adapters/NpiRegistryAdapter',
      'apps/api/backend/src/services/providers/connectors/nppesConnector',
    ],
    notes: 'Official CMS NPI Registry fetch + claim parser in the canonical identity pipeline.',
  },
  OIG_LEIE: {
    sourceId: 'OIG_LEIE',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.OIG_LEIE',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [
      'apps/api/backend/adapters/OigLeieAdapter',
      'packages/source-adapters/src/adapters/oig',
      'packages/psv/sources/oigLeie',
      'apps/api/backend/src/services/providers/connectors/oigConnector',
    ],
    notes: 'Canonical LEIE ingestion uses the maintained bulk/cache path and persists source artifacts.',
  },
  PECOS_PUBLIC: {
    sourceId: 'PECOS_PUBLIC',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.PECOS_PUBLIC',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [
      'packages/source-adapters/src/adapters/pecos',
      'apps/api/backend/src/services/pecosEngine',
      'apps/api/backend/src/services/providers/connectors/pecosConnector',
    ],
    notes: 'Canonical public PECOS query and parser; point-in-time CMS data, not real-time enrollment.',
  },
  OPEN_PAYMENTS: {
    sourceId: 'OPEN_PAYMENTS',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.OPEN_PAYMENTS',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [],
    notes: 'Canonical exact-NPI CMS Open Payments ingestion.',
  },
  SAM_GOV: {
    sourceId: 'SAM_GOV',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.SAM_GOV',
    requiredEnvironmentVariables: ['SAM_GOV_API_KEY'],
    deprecatedAlternateModuleFragments: [
      'apps/api/backend/src/services/samGovAdapter',
    ],
    notes: 'Name-based federal exclusion search; unavailable access must never become a clear result.',
  },
  DOCTORS_CLINICIANS: {
    sourceId: 'DOCTORS_CLINICIANS',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.DOCTORS_CLINICIANS',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [],
    notes: 'Canonical CMS Doctors & Clinicians API lane. E1 expands row and field coverage.',
  },
  NURSYS: {
    sourceId: 'NURSYS',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.NURSYS',
    requiredEnvironmentVariables: ['NURSYS_API_KEY', 'NURSYS_BASE_URL'],
    deprecatedAlternateModuleFragments: [
      'apps/api/backend/adapters/NursysAdapter',
      'apps/api/backend/src/services/nursysAdapter',
      'apps/api/backend/src/services/adapters/nursysStubAdapter',
      'apps/api/backend/src/services/adapters/nursysAccessPendingAdapter',
      'apps/api/backend/src/services/psv-adapters/adapters/nursysAdapter',
      'packages/psv-adapters/adapters/NursysENotifyAdapter',
    ],
    notes: 'Institutional Nursys access only. Stub or access-pending modules are deprecated for production routes.',
  },
  STATE_BOARD: {
    sourceId: 'STATE_BOARD',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.STATE_BOARD',
    requiredEnvironmentVariables: ['FSMB_API_KEY'],
    deprecatedAlternateModuleFragments: [
      'apps/api/backend/adapters/StateBoardAdapter',
      'apps/api/backend/src/services/psv-adapters/adapters/fsmbAdapter',
      'packages/source-adapters/src/adapters/ca-board',
      'packages/source-adapters/src/adapters/ca-pa-board',
      'apps/web/lib/authority/californiaAdapter',
    ],
    notes: 'Canonical physician licensure lane. Individual board modules may support the handler but may not bypass it.',
  },
  OPENALEX: {
    sourceId: 'OPENALEX',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.OPENALEX',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [],
    notes: 'Silver-tier candidate discovery; name-only candidates remain review-required.',
  },
  CLINICAL_TRIALS: {
    sourceId: 'CLINICAL_TRIALS',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.CLINICAL_TRIALS',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [],
    notes: 'Silver-tier trial enrichment; actual source role must be preserved.',
  },
  PUBMED: {
    sourceId: 'PUBMED',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.PUBMED',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [],
    notes: 'Silver-tier literature enrichment; identity resolution requires corroboration.',
  },
  OFAC_SDN: {
    sourceId: 'OFAC_SDN',
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.OFAC_SDN',
    requiredEnvironmentVariables: [],
    deprecatedAlternateModuleFragments: [],
    notes: 'Name-based sanctions candidate lane. Catalog availability remains false until production activation is deliberately proven.',
  },
};

export const CANONICAL_SOURCE_ADAPTER_IDS = Object.freeze(
  Object.keys(CANONICAL_SOURCE_ADAPTERS) as CanonicalSourceAdapterId[],
);

export function getCanonicalSourceAdapter(
  sourceId: string,
): CanonicalSourceAdapterDefinition | null {
  return CANONICAL_SOURCE_ADAPTERS[sourceId as CanonicalSourceAdapterId] ?? null;
}

export function isCanonicalSourceAdapterImplemented(
  sourceId: string,
): sourceId is CanonicalSourceAdapterId {
  return getCanonicalSourceAdapter(sourceId) !== null;
}

export const DEPRECATED_ALTERNATE_ADAPTER_MODULE_FRAGMENTS = Object.freeze(
  CANONICAL_SOURCE_ADAPTER_IDS.flatMap(
    (sourceId) => CANONICAL_SOURCE_ADAPTERS[sourceId].deprecatedAlternateModuleFragments,
  ),
);
