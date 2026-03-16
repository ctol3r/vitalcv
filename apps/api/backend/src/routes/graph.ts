import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { generateGraphLinkSuggestions, applySuggestionDecisions, rejectGraphEdge } from '../services/graph-engine/aiLinker';
import {
  createGraphLayoutStateId,
  createGraphNodeId,
  createGraphPresetId,
  createGraphSuggestionBatchFingerprint,
  createGraphSuggestionBatchId,
} from '../services/graph-engine/ids';
import {
  GRAPH_FILTER_SCHEMA_VERSION,
  defaultGraphQueryFilters,
  normalizeBoolean,
  normalizeClusterMode,
  normalizeGraphMode,
  normalizeScope,
  parseCsvValues,
  coerceEdgeTypes,
  coerceNodeTypes,
} from '../services/graph-engine/schema';
import {
  getGraphDiagnostics,
  enqueueGraphRebuild,
  runGraphRebuild,
} from '../services/graph-engine/rebuildEngine';
import {
  getGraphNode,
  getGraphNodeNeighbors,
  listGraphGroups,
  queryGraph,
  searchGraphNodes,
} from '../services/graph-engine/queryService';
import { buildGraphInvestigationPayload } from '../services/investigation/graphInvestigationService';
import { sendCompressedJson } from '../services/mobile/http';
import {
  buildGraphMobilePayload,
  DEFAULT_MOBILE_DEPTH,
  DEFAULT_MOBILE_LIMIT,
  MAX_MOBILE_DEPTH,
  MAX_MOBILE_GRAPH_LIMIT,
  normalizeMobileView,
  parseBoundedInteger,
} from '../services/mobile/payloads';

function parseGraphFilters(req: Request) {
  const defaults = defaultGraphQueryFilters();
  return {
    ...defaults,
    graphMode: normalizeGraphMode(req.query.graphMode ?? defaults.graphMode),
    scope: normalizeScope(req.query.scope ?? defaults.scope),
    focusNodeId: typeof req.query.focusNodeId === 'string' ? req.query.focusNodeId : defaults.focusNodeId,
    depth: Math.max(1, Math.min(4, Number(req.query.depth ?? defaults.depth) || defaults.depth)),
    nodeTypes: coerceNodeTypes(parseCsvValues(req.query.nodeTypes)),
    edgeTypes: coerceEdgeTypes(parseCsvValues(req.query.edgeTypes)),
    tags: parseCsvValues(req.query.tags),
    groups: parseCsvValues(req.query.groups),
    trustTiers: parseCsvValues(req.query.trustTiers),
    searchTerm: typeof req.query.search === 'string' ? req.query.search : defaults.searchTerm,
    showAttachments: normalizeBoolean(req.query.attachments, defaults.showAttachments),
    showExistingFilesOnly: normalizeBoolean(req.query.existingFilesOnly, defaults.showExistingFilesOnly),
    showOrphans: normalizeBoolean(req.query.orphans, defaults.showOrphans),
    showExplicit: normalizeBoolean(req.query.explicit, defaults.showExplicit),
    showInferred: normalizeBoolean(req.query.inferred, defaults.showInferred),
    showAiLinks: normalizeBoolean(req.query.aiLinks, defaults.showAiLinks),
    includeEdgeStatus: parseCsvValues(req.query.edgeStatus).length > 0
      ? parseCsvValues(req.query.edgeStatus)
      : defaults.includeEdgeStatus,
    clusterMode: normalizeClusterMode(req.query.clusterMode ?? defaults.clusterMode),
    limit: Math.max(1, Math.min(2000, Number(req.query.limit ?? defaults.limit) || defaults.limit)),
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : defaults.cursor,
  };
}

function sendCanonicalResult(res: Response, result: Awaited<ReturnType<typeof queryGraph>>): void {
  res.json({
    snapshotId: result.snapshotId,
    graphMode: result.graphMode,
    scope: result.scope,
    focusNodeId: result.focusNodeId,
    depth: result.depth,
    generatedAt: result.generatedAt,
    cacheStatus: result.cacheStatus,
    filters: result.filters,
    nodes: result.chunk.nodes,
    edges: result.chunk.edges,
    nextCursor: result.chunk.nextCursor,
    truncated: result.chunk.truncated,
    intelligence: result.intelligence,
    stats: result.stats,
  });
}

function buildGraphMobileSelfLink(
  basePath: string,
  result: Awaited<ReturnType<typeof queryGraph>>,
): string {
  return `${basePath}?view=mobile&depth=${result.depth}&limit=${result.filters.limit}${result.filters.cursor ? `&cursor=${result.filters.cursor}` : ''}`;
}

function buildGraphMobileNextLink(
  basePath: string,
  result: Awaited<ReturnType<typeof queryGraph>>,
): string | null {
  return result.chunk.nextCursor
    ? `${basePath}?view=mobile&depth=${result.depth}&limit=${result.filters.limit}&cursor=${result.chunk.nextCursor}`
    : null;
}

function mobileGraphFilters(req: Request, focusNodeId: string) {
  return {
    ...parseGraphFilters(req),
    graphMode: normalizeGraphMode(req.query.graphMode ?? 'trust'),
    scope: 'local' as const,
    focusNodeId,
    depth: parseBoundedInteger(req.query.depth, DEFAULT_MOBILE_DEPTH, 1, MAX_MOBILE_DEPTH),
    limit: parseBoundedInteger(req.query.limit, DEFAULT_MOBILE_LIMIT, 1, MAX_MOBILE_GRAPH_LIMIT),
    clusterMode: 'none' as const,
    showAiLinks: false,
  };
}

function mapLegacyNodeType(type: string): 'clinician' | 'credential' | 'issuer' | 'hospital' | 'license' {
  if (type === 'clinician') return 'clinician';
  if (type === 'license') return 'license';
  if (type === 'source') return 'issuer';
  if (type === 'organization' || type === 'institution') return 'hospital';
  return 'credential';
}

async function ensureClinicianGraph(npi: string): Promise<string> {
  const clinicianNodeId = createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
  const existing = await prisma.graphNode.findUnique({ where: { id: clinicianNodeId } });
  if (!existing) {
    await runGraphRebuild({
      buildType: 'incremental',
      graphMode: 'blended',
      targetNodeId: clinicianNodeId,
      invalidationReasons: [`npi:${npi}`],
      requestedBy: 'graph-route',
    });
  }
  return clinicianNodeId;
}

export function registerGraphRoutes(app: Express): void {
  app.get('/api/graph/global', async (req: Request, res: Response) => {
    try {
      const result = await queryGraph({
        ...parseGraphFilters(req),
        scope: 'global',
      });
      sendCanonicalResult(res, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'graph_route: global failed', { error: message });
      res.status(500).json({ error: 'Failed to load global graph' });
    }
  });

  app.get('/api/graph/local/:nodeId', async (req: Request, res: Response) => {
    try {
      const nodeId = decodeURIComponent(req.params.nodeId);
      if (normalizeMobileView(req.query.view) === 'mobile') {
        const result = await queryGraph(mobileGraphFilters(req, nodeId));
        const basePath = `/api/graph/local/${encodeURIComponent(nodeId)}`;
        const payload = buildGraphMobilePayload(result, {
          self: buildGraphMobileSelfLink(basePath, result),
          next: buildGraphMobileNextLink(basePath, result),
          expand: result.focusNodeId
            ? `/api/graph/node/${encodeURIComponent(result.focusNodeId)}/expand?view=mobile&depth=1&limit=${result.filters.limit}`
            : null,
        });
        sendCompressedJson(req, res, payload, { enabled: true });
        return;
      }

      const result = await queryGraph({
        ...parseGraphFilters(req),
        scope: 'local',
        focusNodeId: nodeId,
      });
      sendCanonicalResult(res, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'graph_route: local failed', { nodeId: req.params.nodeId, error: message });
      res.status(500).json({ error: 'Failed to load local graph' });
    }
  });

  app.get('/api/graph/mobile/:nodeId', async (req: Request, res: Response) => {
    try {
      const nodeId = decodeURIComponent(req.params.nodeId);
      const result = await queryGraph(mobileGraphFilters(req, nodeId));
      const basePath = `/api/graph/mobile/${encodeURIComponent(nodeId)}`;
      const payload = buildGraphMobilePayload(result, {
        self: buildGraphMobileSelfLink(basePath, result),
        next: buildGraphMobileNextLink(basePath, result),
        expand: result.focusNodeId
          ? `/api/graph/node/${encodeURIComponent(result.focusNodeId)}/expand?view=mobile&depth=1&limit=${result.filters.limit}`
          : null,
      });
      sendCompressedJson(req, res, payload, { enabled: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'graph_route: mobile failed', { nodeId: req.params.nodeId, error: message });
      res.status(500).json({ error: 'Failed to load mobile graph' });
    }
  });

  app.get('/api/graph/node/:id', async (req: Request, res: Response) => {
    try {
      const node = await getGraphNode(decodeURIComponent(req.params.id));
      if (!node) {
        res.status(404).json({ error: 'Graph node not found' });
        return;
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load graph node' });
    }
  });

  app.get('/api/graph/node/:id/neighbors', async (req: Request, res: Response) => {
    try {
      const result = await getGraphNodeNeighbors(
        decodeURIComponent(req.params.id),
        Math.max(1, Math.min(4, Number(req.query.depth ?? 1) || 1)),
      );
      sendCanonicalResult(res, result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load node neighbors' });
    }
  });

  app.get('/api/graph/search', async (req: Request, res: Response) => {
    try {
      const search = typeof req.query.q === 'string' ? req.query.q : '';
      const nodes = await searchGraphNodes(search);
      res.json({ query: search, nodes });
    } catch (error) {
      res.status(500).json({ error: 'Failed to search graph nodes' });
    }
  });

  app.get('/api/graph/investigation', async (req: Request, res: Response) => {
    try {
      const relationshipTypes = typeof req.query.relationshipTypes === 'string'
        ? req.query.relationshipTypes.split(',').map((value) => value.trim()).filter((value) => value.length > 0)
        : [];
      const payload = await buildGraphInvestigationPayload({
        providerId: typeof req.query.providerId === 'string' ? req.query.providerId : null,
        focusNodeId: typeof req.query.focusNodeId === 'string' ? req.query.focusNodeId : null,
        depth: Math.max(1, Math.min(4, Number(req.query.depth ?? 2) || 2)),
        relationshipTypes: relationshipTypes as Parameters<typeof buildGraphInvestigationPayload>[0]['relationshipTypes'],
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : null,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : null,
        findingId: typeof req.query.findingId === 'string' ? req.query.findingId : null,
        storylineId: typeof req.query.storylineId === 'string' ? req.query.storylineId : null,
        sourceNodeId: typeof req.query.sourceNodeId === 'string' ? req.query.sourceNodeId : null,
        targetNodeId: typeof req.query.targetNodeId === 'string' ? req.query.targetNodeId : null,
      });

      res.json({
        schema: 'https://vitalcv.com/graph/investigation/v1',
        ...payload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'graph_route: investigation failed', { error: message });
      res.status(500).json({ error: 'Failed to load investigation graph', detail: message });
    }
  });

  app.get('/api/graph/groups', async (req: Request, res: Response) => {
    try {
      const graphMode = normalizeGraphMode(req.query.graphMode ?? 'blended');
      res.json({
        graphMode,
        groups: await listGraphGroups(graphMode),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load graph groups' });
    }
  });

  app.get('/api/graph/presets', async (req: Request, res: Response) => {
    try {
      const ownerKey = typeof req.query.ownerKey === 'string' ? req.query.ownerKey : 'system';
      const presets = await prisma.graphPreset.findMany({
        where: { ownerKey },
        orderBy: [{ updatedAt: 'desc' }],
      });
      res.json({ ownerKey, presets });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load graph presets' });
    }
  });

  app.post('/api/graph/presets', async (req: Request, res: Response) => {
    try {
      const ownerKey = typeof req.body?.ownerKey === 'string' ? req.body.ownerKey : 'system';
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name) {
        res.status(400).json({ error: 'Preset name is required' });
        return;
      }

      const presetId = createGraphPresetId({ ownerKey, name });
      const preset = await prisma.graphPreset.upsert({
        where: { ownerKey_name: { ownerKey, name } },
        update: {
          graphMode: normalizeGraphMode(req.body?.graphMode ?? 'blended'),
          focusNodeId: typeof req.body?.focusNodeId === 'string' ? req.body.focusNodeId : null,
          depth: Math.max(1, Math.min(4, Number(req.body?.depth ?? 2) || 2)),
          filterSchemaVersion: GRAPH_FILTER_SCHEMA_VERSION,
          filters: req.body?.filters ?? {},
          display: req.body?.display ?? {},
          physics: req.body?.physics ?? {},
          camera: req.body?.camera ?? {},
          pinnedNodes: req.body?.pinnedNodes ?? {},
          status: typeof req.body?.status === 'string' ? req.body.status : 'ACTIVE',
        },
        create: {
          id: presetId,
          ownerKey,
          name,
          graphMode: normalizeGraphMode(req.body?.graphMode ?? 'blended'),
          focusNodeId: typeof req.body?.focusNodeId === 'string' ? req.body.focusNodeId : null,
          depth: Math.max(1, Math.min(4, Number(req.body?.depth ?? 2) || 2)),
          filterSchemaVersion: GRAPH_FILTER_SCHEMA_VERSION,
          filters: req.body?.filters ?? {},
          display: req.body?.display ?? {},
          physics: req.body?.physics ?? {},
          camera: req.body?.camera ?? {},
          pinnedNodes: req.body?.pinnedNodes ?? {},
          status: typeof req.body?.status === 'string' ? req.body.status : 'ACTIVE',
        },
      });
      res.status(201).json(preset);
    } catch (error) {
      res.status(500).json({ error: 'Failed to save graph preset' });
    }
  });

  app.get('/api/graph/layout', async (req: Request, res: Response) => {
    try {
      const ownerKey = typeof req.query.ownerKey === 'string' ? req.query.ownerKey : 'system';
      const scopeType = typeof req.query.scopeType === 'string' ? req.query.scopeType : 'global';
      const scopeKey = typeof req.query.scopeKey === 'string' ? req.query.scopeKey : 'blended';
      const graphMode = normalizeGraphMode(req.query.graphMode ?? 'blended');
      const filterSignature = typeof req.query.filterSignature === 'string' ? req.query.filterSignature : '{}';

      const layout = await prisma.graphLayoutState.findUnique({
        where: {
          ownerKey_scopeType_scopeKey_graphMode_filterSignature: {
            ownerKey,
            scopeType,
            scopeKey,
            graphMode,
            filterSignature,
          },
        },
      });

      if (!layout) {
        res.status(404).json({ error: 'Graph layout state not found' });
        return;
      }

      res.json(layout);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load graph layout state' });
    }
  });

  app.post('/api/graph/rebuild', async (req: Request, res: Response) => {
    try {
      const input = {
        buildType: (typeof req.body?.buildType === 'string' ? req.body.buildType : 'full') as 'full' | 'incremental' | 'node' | 'stale',
        graphMode: normalizeGraphMode(req.body?.graphMode ?? 'blended'),
        targetNodeId: typeof req.body?.targetNodeId === 'string' ? req.body.targetNodeId : null,
        invalidationReasons: Array.isArray(req.body?.invalidationReasons) ? req.body.invalidationReasons : [],
        requestedBy: typeof req.body?.requestedBy === 'string' ? req.body.requestedBy : 'api',
      };
      const sync = normalizeBoolean(req.body?.sync, true);

      if (sync) {
        res.json(await runGraphRebuild(input));
      } else {
        res.status(202).json(await enqueueGraphRebuild(input));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to trigger graph rebuild', detail: message });
    }
  });

  app.post('/api/graph/ai-links/suggest', async (req: Request, res: Response) => {
    try {
      const graphMode = normalizeGraphMode(req.body?.graphMode ?? 'blended');
      const targetNodeId = typeof req.body?.targetNodeId === 'string' ? req.body.targetNodeId : null;
      const maxSuggestionsPerNode = Math.max(1, Math.min(25, Number(req.body?.maxSuggestionsPerNode ?? 10) || 10));
      const minConfidence = Math.max(0, Math.min(1, Number(req.body?.minConfidence ?? 0.3) || 0.3));
      const applyThreshold = Math.max(0, Math.min(1, Number(req.body?.applyThreshold ?? 0.85) || 0.85));
      const sync = normalizeBoolean(req.body?.sync, true);
      if (!sync) {
        const filterSignature = JSON.stringify({
          graphMode,
          targetNodeId,
        });
        const requestFingerprint = createGraphSuggestionBatchFingerprint({
          graphMode,
          targetNodeId,
          filterSignature,
          maxSuggestionsPerNode,
          minConfidence,
          applyThreshold,
        });
        const existingBatch = await prisma.graphSuggestionBatch.findFirst({
          where: {
            requestFingerprint,
            status: { in: ['QUEUED', 'RUNNING'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (existingBatch) {
          res.status(202).json({ batchId: existingBatch.id, deduped: true });
          return;
        }

        const batchId = createGraphSuggestionBatchId({
          graphMode,
          targetNodeId,
          filterSignature: JSON.stringify({
            graphMode,
            targetNodeId,
          }),
        });
        await prisma.graphSuggestionBatch.create({
          data: {
            id: batchId,
            status: 'QUEUED',
            requestFingerprint,
            graphMode,
            targetNodeId,
            filterSignature: JSON.stringify({
              graphMode,
              targetNodeId,
            }),
            maxSuggestionsPerNode,
            minConfidence,
            applyThreshold,
          },
        });
        res.status(202).json({ batchId });
        return;
      }

      res.json(await generateGraphLinkSuggestions({
        graphMode,
        targetNodeId,
        reviewerId: typeof req.body?.reviewerId === 'string' ? req.body.reviewerId : null,
        maxSuggestionsPerNode,
        minConfidence,
        applyThreshold,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to generate graph suggestions', detail: message });
    }
  });

  app.post('/api/graph/ai-links/apply', async (req: Request, res: Response) => {
    try {
      const suggestionIds = Array.isArray(req.body?.suggestionIds)
        ? req.body.suggestionIds.filter((value: unknown): value is string => typeof value === 'string')
        : undefined;
      res.json(await applySuggestionDecisions({
        suggestionIds,
        batchId: typeof req.body?.batchId === 'string' ? req.body.batchId : undefined,
        threshold: typeof req.body?.threshold === 'number' ? req.body.threshold : undefined,
        action: (typeof req.body?.action === 'string' ? req.body.action : 'accept') as 'accept' | 'reject' | 'ignore',
        reviewerId: typeof req.body?.reviewerId === 'string' ? req.body.reviewerId : null,
        rationale: typeof req.body?.rationale === 'string' ? req.body.rationale : null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to apply suggestion decisions', detail: message });
    }
  });

  app.post('/api/graph/edge/reject', async (req: Request, res: Response) => {
    try {
      res.json(await rejectGraphEdge({
        edgeId: typeof req.body?.edgeId === 'string' ? req.body.edgeId : undefined,
        sourceNodeId: typeof req.body?.sourceNodeId === 'string' ? req.body.sourceNodeId : undefined,
        targetNodeId: typeof req.body?.targetNodeId === 'string' ? req.body.targetNodeId : undefined,
        edgeType: typeof req.body?.edgeType === 'string' ? req.body.edgeType : undefined,
        reviewerId: typeof req.body?.reviewerId === 'string' ? req.body.reviewerId : null,
        rationale: typeof req.body?.rationale === 'string' ? req.body.rationale : null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to reject graph edge', detail: message });
    }
  });

  app.post('/api/graph/layout/save', async (req: Request, res: Response) => {
    try {
      const ownerKey = typeof req.body?.ownerKey === 'string' ? req.body.ownerKey : 'system';
      const scopeType = typeof req.body?.scopeType === 'string' ? req.body.scopeType : 'global';
      const scopeKey = typeof req.body?.scopeKey === 'string' ? req.body.scopeKey : 'blended';
      const graphMode = normalizeGraphMode(req.body?.graphMode ?? 'blended');
      const filterSignature = typeof req.body?.filterSignature === 'string' ? req.body.filterSignature : '{}';
      const id = createGraphLayoutStateId({
        ownerKey,
        scopeType,
        scopeKey,
        graphMode,
        filterSignature,
      });

      const layout = await prisma.graphLayoutState.upsert({
        where: {
          ownerKey_scopeType_scopeKey_graphMode_filterSignature: {
            ownerKey,
            scopeType,
            scopeKey,
            graphMode,
            filterSignature,
          },
        },
        update: {
          positions: req.body?.positions ?? {},
          pinnedNodes: req.body?.pinnedNodes ?? {},
          frozenNodeIds: Array.isArray(req.body?.frozenNodeIds) ? req.body.frozenNodeIds : [],
          camera: req.body?.camera ?? {},
          display: req.body?.display ?? {},
          metadata: req.body?.metadata ?? {},
        },
        create: {
          id,
          ownerKey,
          scopeType,
          scopeKey,
          graphMode,
          filterSignature,
          positions: req.body?.positions ?? {},
          pinnedNodes: req.body?.pinnedNodes ?? {},
          frozenNodeIds: Array.isArray(req.body?.frozenNodeIds) ? req.body.frozenNodeIds : [],
          camera: req.body?.camera ?? {},
          display: req.body?.display ?? {},
          metadata: req.body?.metadata ?? {},
        },
      });

      res.status(201).json(layout);
    } catch (error) {
      res.status(500).json({ error: 'Failed to save graph layout state' });
    }
  });

  app.post('/api/graph/node/pin', async (req: Request, res: Response) => {
    try {
      const ownerKey = typeof req.body?.ownerKey === 'string' ? req.body.ownerKey : 'system';
      const scopeType = typeof req.body?.scopeType === 'string' ? req.body.scopeType : 'local';
      const scopeKey = typeof req.body?.scopeKey === 'string' ? req.body.scopeKey : 'blended';
      const graphMode = normalizeGraphMode(req.body?.graphMode ?? 'blended');
      const filterSignature = typeof req.body?.filterSignature === 'string' ? req.body.filterSignature : '{}';
      const nodeId = typeof req.body?.nodeId === 'string' ? req.body.nodeId : null;
      if (!nodeId) {
        res.status(400).json({ error: 'nodeId is required' });
        return;
      }

      const current = await prisma.graphLayoutState.findUnique({
        where: {
          ownerKey_scopeType_scopeKey_graphMode_filterSignature: {
            ownerKey,
            scopeType,
            scopeKey,
            graphMode,
            filterSignature,
          },
        },
      });
      const pinnedNodes = {
        ...(current?.pinnedNodes as Record<string, { x: number; y: number }> | undefined ?? {}),
        [nodeId]: {
          x: Number(req.body?.x ?? 0),
          y: Number(req.body?.y ?? 0),
        },
      };
      const id = createGraphLayoutStateId({ ownerKey, scopeType, scopeKey, graphMode, filterSignature });
      const layout = await prisma.graphLayoutState.upsert({
        where: {
          ownerKey_scopeType_scopeKey_graphMode_filterSignature: {
            ownerKey,
            scopeType,
            scopeKey,
            graphMode,
            filterSignature,
          },
        },
        update: {
          pinnedNodes,
        },
        create: {
          id,
          ownerKey,
          scopeType,
          scopeKey,
          graphMode,
          filterSignature,
          positions: {},
          pinnedNodes,
          frozenNodeIds: [],
          camera: {},
          display: {},
          metadata: {},
        },
      });
      res.json(layout);
    } catch (error) {
      res.status(500).json({ error: 'Failed to pin graph node' });
    }
  });

  app.get('/api/graph/diagnostics', async (req: Request, res: Response) => {
    try {
      const diagnostics = await getGraphDiagnostics();
      const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20) || 20));
      res.json({
        ...diagnostics,
        orphanNodes: diagnostics.orphanNodes.slice(0, limit),
        rejectMemoryInventory: diagnostics.rejectMemoryInventory.slice(0, limit),
        reciprocalIssues: diagnostics.reciprocalIssues.slice(0, limit),
        payloadSizeDiagnostics: diagnostics.payloadSizeDiagnostics.slice(0, limit),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load graph diagnostics' });
    }
  });

  app.get('/api/graph/:npi([0-9]{10})', async (req: Request, res: Response) => {
    try {
      const nodeId = await ensureClinicianGraph(req.params.npi);
      if (normalizeMobileView(req.query.view) === 'mobile') {
        const result = await queryGraph(mobileGraphFilters(req, nodeId));
        const basePath = `/api/graph/${req.params.npi}`;
        const payload = buildGraphMobilePayload(result, {
          self: buildGraphMobileSelfLink(basePath, result),
          next: buildGraphMobileNextLink(basePath, result),
          expand: `/api/graph/mobile/${encodeURIComponent(nodeId)}?depth=1&limit=${result.filters.limit}`,
        });
        sendCompressedJson(req, res, payload, { enabled: true });
        return;
      }

      const result = await queryGraph({
        ...parseGraphFilters(req),
        scope: 'local',
        focusNodeId: nodeId,
        depth: Math.max(1, Math.min(4, Number(req.query.depth ?? 2) || 2)),
      });
      res.json({
        npi: req.params.npi,
        snapshotId: result.snapshotId,
        nodes: result.chunk.nodes,
        edges: result.chunk.edges,
        nextCursor: result.chunk.nextCursor,
        truncated: result.chunk.truncated,
        stats: result.stats,
        generatedAt: result.generatedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to load clinician graph', detail: message });
    }
  });

  app.get('/api/graph/live/:npi([0-9]{10})', async (req: Request, res: Response) => {
    try {
      const nodeId = await ensureClinicianGraph(req.params.npi);
      const result = await queryGraph({
        graphMode: 'trust',
        scope: 'local',
        focusNodeId: nodeId,
        depth: 2,
        limit: 300,
      });
      res.json({
        nodes: result.chunk.nodes.map((node) => ({
          id: node.id,
          type: mapLegacyNodeType(node.type),
          label: node.label,
          trustLevel: node.trustBand ?? node.trustTier ?? 'L0',
          status: (node.metadata.status as string | undefined) ?? 'active',
          metadata: node.metadata,
        })),
        edges: result.chunk.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight,
          createdAt: edge.createdAt,
        })),
        stats: {
          nodeCount: result.stats.totalNodes,
          edgeCount: result.stats.totalEdges,
          avgTrustScore: result.chunk.nodes.length > 0
            ? Math.round((result.chunk.nodes.reduce((sum, node) => sum + (Number(node.confidence ?? 0.5) * 100), 0) / result.chunk.nodes.length))
            : 0,
        },
        generatedAt: result.generatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load live graph' });
    }
  });

  app.get('/api/graph/network', async (req: Request, res: Response) => {
    try {
      const result = await queryGraph({
        ...parseGraphFilters(req),
        graphMode: 'trust',
        scope: 'global',
      });
      res.json({
        nodes: result.chunk.nodes.map((node) => ({
          id: node.id,
          type: mapLegacyNodeType(node.type),
          label: node.label,
          trustLevel: node.trustBand ?? node.trustTier ?? 'L0',
          status: (node.metadata.status as string | undefined) ?? 'active',
          metadata: node.metadata,
        })),
        edges: result.chunk.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight,
          createdAt: edge.createdAt,
        })),
        stats: {
          nodeCount: result.stats.totalNodes,
          edgeCount: result.stats.totalEdges,
          avgTrustScore: result.chunk.nodes.length > 0
            ? Math.round((result.chunk.nodes.reduce((sum, node) => sum + (Number(node.confidence ?? 0.5) * 100), 0) / result.chunk.nodes.length))
            : 0,
        },
        generatedAt: result.generatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load network graph' });
    }
  });

  app.get('/api/graph/node/:nodeId/expand', async (req: Request, res: Response) => {
    try {
      const nodeId = decodeURIComponent(req.params.nodeId);
      if (normalizeMobileView(req.query.view) === 'mobile') {
        const result = await queryGraph({
          ...mobileGraphFilters(req, nodeId),
          depth: parseBoundedInteger(req.query.depth, DEFAULT_MOBILE_DEPTH, 1, MAX_MOBILE_DEPTH),
        });
        const basePath = `/api/graph/node/${encodeURIComponent(nodeId)}/expand`;
        const payload = buildGraphMobilePayload(result, {
          self: buildGraphMobileSelfLink(basePath, result),
          next: buildGraphMobileNextLink(basePath, result),
          expand: null,
        });
        sendCompressedJson(req, res, payload, { enabled: true });
        return;
      }

      const result = await getGraphNodeNeighbors(
        nodeId,
        Math.max(1, Math.min(2, Number(req.query.depth ?? 1) || 1)),
      );
      res.json({
        nodes: result.chunk.nodes.map((node) => ({
          id: node.id,
          type: mapLegacyNodeType(node.type),
          label: node.label,
          trustLevel: node.trustBand ?? node.trustTier ?? 'L0',
          status: (node.metadata.status as string | undefined) ?? 'active',
          metadata: node.metadata,
        })),
        edges: result.chunk.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight,
          createdAt: edge.createdAt,
        })),
        stats: {
          nodeCount: result.stats.totalNodes,
          edgeCount: result.stats.totalEdges,
          avgTrustScore: result.chunk.nodes.length > 0
            ? Math.round((result.chunk.nodes.reduce((sum, node) => sum + (Number(node.confidence ?? 0.5) * 100), 0) / result.chunk.nodes.length))
            : 0,
        },
        generatedAt: result.generatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to expand node neighborhood' });
    }
  });
}
