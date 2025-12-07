import type { IdentitySource } from './ingestion-v3';

export interface LineageNode {
  sourceId: string;
  sourceType: string;
  timestamp: string;
  dataHash: string;
  parentSourceIds?: string[];
}

export interface IdentityLineage {
  clinicianId: string;
  nodes: LineageNode[];
  rootNodes: LineageNode[];
  leafNodes: LineageNode[];
  chain: LineageNode[];
}

/**
 * Track chain of evidence from each identity source
 */
export function buildIdentityLineage(
  clinicianId: string,
  sources: IdentitySource[],
): IdentityLineage {
  const nodes: LineageNode[] = sources.map((source) => ({
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    timestamp: source.timestamp,
    dataHash: computeDataHash(source.data),
  }));

  // Identify root nodes (sources with no dependencies)
  const rootNodes = nodes.filter((node) => {
    // NPPES and STATE_BOARD are typically root sources
    return node.sourceType === 'NPPES' || node.sourceType === 'STATE_BOARD';
  });

  // Identify leaf nodes (sources that depend on others)
  const leafNodes = nodes.filter((node) => {
    // NPDB and GLOBAL_REGULATOR may reference other sources
    return node.sourceType === 'NPDB' || node.sourceType === 'GLOBAL_REGULATOR';
  });

  // Build chain (chronological order)
  const chain = [...nodes].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    clinicianId,
    nodes,
    rootNodes,
    leafNodes,
    chain,
  };
}

function computeDataHash(data: Record<string, unknown>): string {
  const crypto = require('crypto');
  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Get lineage path for a specific field
 */
export function getFieldLineage(
  field: string,
  lineage: IdentityLineage,
  sources: IdentitySource[],
): LineageNode[] {
  const relevantNodes: LineageNode[] = [];

  for (const source of sources) {
    if (field in source.data && source.data[field] !== null && source.data[field] !== undefined) {
      const node = lineage.nodes.find((n) => n.sourceId === source.sourceId);
      if (node) {
        relevantNodes.push(node);
      }
    }
  }

  return relevantNodes.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

