import {
  CANONICAL_SOURCE_ADAPTER_IDS,
  CANONICAL_SOURCE_ADAPTERS,
} from '../canonicalSourceAdapters';
import {
  IMPLEMENTED_INGEST_SOURCE_IDS,
  getSource,
} from '../sourceCatalog';
import {
  IDENTITY_INGESTION_HANDLER_IDS,
} from '../identityIngestionPipeline';

describe('canonical source registry and pipeline alignment', () => {
  test('implemented catalog, canonical adapters, and pipeline handlers are identical', () => {
    const catalog = [...IMPLEMENTED_INGEST_SOURCE_IDS].sort();
    const adapters = [...CANONICAL_SOURCE_ADAPTER_IDS].sort();
    const handlers = [...IDENTITY_INGESTION_HANDLER_IDS].sort();

    expect(adapters).toEqual(catalog);
    expect(handlers).toEqual(catalog);
  });

  test('every canonical adapter points to its exact pipeline handler and catalog source', () => {
    for (const sourceId of CANONICAL_SOURCE_ADAPTER_IDS) {
      expect(getSource(sourceId)).not.toBeNull();
      expect(CANONICAL_SOURCE_ADAPTERS[sourceId].canonicalEntryPoint).toBe(
        `identityIngestionPipeline.handlers.${sourceId}`,
      );
    }
  });

  test('implemented does not mean live', () => {
    expect(getSource('OFAC_SDN')?.liveAvailable).toBe(false);
  });
});
