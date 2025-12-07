import { Router, type Request, type Response } from 'express';
import { IssuerFederation } from '@prisma/client';
import {
  addFederatedIssuer,
  getFederatedIssuers,
  isInFederation,
  listFederationGraph,
  removeFederatedIssuer,
} from '../../services/trust/federation';
import { listTrustWeights } from '../../services/trust/weights';
import { computeTemporalTrustScore } from '../../services/trust/temporal';
import { buildTrustEvidencePack } from '../../services/trust/evidence';
import { evaluateIssuerConfidence, TRUST_WEIGHT_THRESHOLD } from '../../services/trust/confidence';
import { buildLineageGraph } from '../../services/trust/lineage';
import { evaluateTrustAnomalies, listTrustBreaches } from '../../services/trust/breach';

const router = Router();

router.get('/trust/federation/tree', async (_req: Request, res: Response) => {
  try {
    const edges = await listFederationGraph();
    const payload = buildTreePayload(edges);
    return res.json(payload);
  } catch (error) {
    console.error('[trust][federation] failed to load tree', error);
    return res.status(500).json({
      error: 'federation_tree_failed',
      message: error instanceof Error ? error.message : 'Unable to build federation tree',
    });
  }
});

router.get('/trust/federation/:parentDid', async (req: Request, res: Response) => {
  try {
    const parentDid = String(req.params.parentDid).trim();
    if (!parentDid) {
      return res.status(400).json({ error: 'parent_did_required' });
    }
    const members = await getFederatedIssuers(parentDid);
    return res.json({
      parentDid,
      children: members,
      resolvedAt: new Date().toISOString(),
      total: members.length,
    });
  } catch (error) {
    console.error('[trust][federation] failed to list children', error);
    return res.status(500).json({
      error: 'federation_list_failed',
      message: error instanceof Error ? error.message : 'Unable to list federated issuers',
    });
  }
});

router.post('/trust/federation', async (req: Request, res: Response) => {
  try {
    const { parentDid, childDid, trustLevel, metadata } = req.body ?? {};
    if (!parentDid || !childDid) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'parentDid and childDid are required',
      });
    }

    const created = await addFederatedIssuer({
      parentDid: String(parentDid).trim(),
      childDid: String(childDid).trim(),
      trustLevel: Number.isFinite(Number(trustLevel)) ? Number(trustLevel) : 3,
      metadata: metadata ?? {},
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('[trust][federation] failed to add link', error);
    return res.status(500).json({
      error: 'federation_create_failed',
      message: error instanceof Error ? error.message : 'Unable to add federated issuer',
    });
  }
});

router.delete('/trust/federation/:parentDid/:childDid', async (req: Request, res: Response) => {
  try {
    const parentDid = String(req.params.parentDid).trim();
    const childDid = String(req.params.childDid).trim();
    if (!parentDid || !childDid) {
      return res.status(400).json({ error: 'missing_identifier' });
    }

    const removed = await removeFederatedIssuer(parentDid, childDid);
    if (!removed) {
      return res.status(404).json({ error: 'federation_link_not_found' });
    }

    return res.status(204).send('');
  } catch (error) {
    console.error('[trust][federation] failed to remove link', error);
    return res.status(500).json({
      error: 'federation_remove_failed',
      message: error instanceof Error ? error.message : 'Unable to remove federated issuer',
    });
  }
});

router.get('/trust/federation/resolve/indirect', async (req: Request, res: Response) => {
  try {
    const parentDid = typeof req.query.parentDid === 'string' ? req.query.parentDid.trim() : '';
    const candidateDid =
      typeof req.query.candidateDid === 'string' ? req.query.candidateDid.trim() : '';

    if (!parentDid || !candidateDid) {
      return res.status(400).json({
        error: 'invalid_query',
        message: 'parentDid and candidateDid are required query parameters',
      });
    }

    const resolution = await isInFederation(parentDid, candidateDid);
    if (!resolution) {
      return res.status(404).json({
        parentDid,
        candidateDid,
        federated: false,
      });
    }

    return res.json({
      ...resolution,
      federated: true,
      resolvedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[trust][federation] failed to resolve link', error);
    return res.status(500).json({
      error: 'federation_resolve_failed',
      message: error instanceof Error ? error.message : 'Unable to resolve federation path',
    });
  }
});

router.get('/trust/fabric/panel', async (_req: Request, res: Response) => {
  try {
    const weights = await listTrustWeights(50);
    const issuerProfiles = await Promise.all(
      weights.map(async (weight) => {
        const [temporal, evidence, confidence] = await Promise.all([
          computeTemporalTrustScore(weight.issuerDid),
          buildTrustEvidencePack(weight.issuerDid).catch(() => null),
          evaluateIssuerConfidence(weight.issuerDid).catch(() => null),
        ]);

        await evaluateTrustAnomalies(weight.issuerDid, {
          revocationRate: evidence?.revocationRate,
          monthsInactive: temporal.monthsInactive,
          requiresSecondFactor: confidence?.requiresSecondFactor,
        });

        return {
          did: weight.issuerDid,
          orgName: evidence?.metadata.orgName ?? null,
          orgNpi: evidence?.metadata.orgNpi ?? null,
          weight: weight.weight,
          normalizedWeight: weight.normalizedWeight,
          adjustedWeight: temporal.adjustedWeight,
          adjustedNormalized: temporal.adjustedNormalized,
          lastIssuanceAt: temporal.lastIssuanceAt,
          monthsInactive: temporal.monthsInactive,
          temporalStatus: temporal.status,
          confidence: confidence?.confidence ?? temporal.adjustedNormalized,
          requiresSecondFactor:
            confidence?.requiresSecondFactor ?? temporal.adjustedNormalized < TRUST_WEIGHT_THRESHOLD,
          revocationRate: evidence?.revocationRate ?? 0,
          issuanceCount: evidence?.issuanceCount ?? 0,
          anchorCount: evidence?.chainAnchors.length ?? 0,
          lastAnchorAt: evidence?.chainAnchors[0]?.anchoredAt,
          lineageDepth: confidence?.lineageDepth ?? 0,
          federationPath: confidence?.federationPath ?? [],
          notes: confidence?.notes ?? [],
        };
      }),
    );

    const breaches = listTrustBreaches();
    const breachMap = new Map(breaches.map((entry) => [entry.issuerDid, entry]));
    const issuers = issuerProfiles.map((profile) => {
      const breach = breachMap.get(profile.did);
      const status = deriveIssuerStatus(profile, breach);
      return {
        ...profile,
        status,
        breach: breach ?? null,
      };
    });

    const overallConfidence =
      issuers.length > 0
        ? Number(
            (
              issuers.reduce((sum, issuer) => sum + (issuer.confidence ?? 0), 0) /
              issuers.length
            ).toFixed(3),
          )
        : 0;

    return res.json({
      threshold: TRUST_WEIGHT_THRESHOLD,
      overallConfidence,
      issuers,
      breaches,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[trust][fabric] failed to build panel', error);
    return res.status(500).json({
      error: 'trust_fabric_panel_failed',
      message: error instanceof Error ? error.message : 'Unable to build trust fabric panel',
    });
  }
});

router.get('/trust/fabric/evidence/:issuerDid', async (req: Request, res: Response) => {
  try {
    const issuerDid = String(req.params.issuerDid ?? '').trim();
    if (!issuerDid) {
      return res.status(400).json({ error: 'issuer_did_required' });
    }
    const pack = await buildTrustEvidencePack(issuerDid);
    return res.json(pack);
  } catch (error) {
    console.error('[trust][fabric] failed to load evidence pack', error);
    return res.status(500).json({
      error: 'trust_evidence_failed',
      message: error instanceof Error ? error.message : 'Unable to build evidence pack',
    });
  }
});

router.get('/trust/fabric/lineage', async (req: Request, res: Response) => {
  try {
    const issuerDid =
      typeof req.query.issuerDid === 'string' && req.query.issuerDid.trim().length
        ? req.query.issuerDid.trim()
        : undefined;
    const graph = await buildLineageGraph(issuerDid);
    return res.json({
      ...graph,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[trust][fabric] failed to load lineage graph', error);
    return res.status(500).json({
      error: 'trust_lineage_failed',
      message: error instanceof Error ? error.message : 'Unable to build lineage graph',
    });
  }
});

export default router;

interface FederationTreeNode {
  did: string;
  parentDid?: string;
  trustLevel?: number;
  metadata?: Record<string, any> | null;
  createdAt?: string;
  children: FederationTreeNode[];
}

function buildTreePayload(edges: IssuerFederation[]) {
  const adjacency = edges.reduce<Record<string, IssuerFederation[]>>((acc, edge) => {
    acc[edge.parentDid] = acc[edge.parentDid] || [];
    acc[edge.parentDid].push(edge);
    return acc;
  }, {});

  const parents = new Set(edges.map((edge) => edge.parentDid));
  const childSet = new Set(edges.map((edge) => edge.childDid));
  const roots = Array.from(parents).filter((did) => !childSet.has(did));
  const seeds = roots.length ? roots : Array.from(parents);

  const buildNode = (
    did: string,
    parentDid?: string,
    link?: IssuerFederation,
  ): FederationTreeNode => {
    const children = adjacency[did] ?? [];
    return {
      did,
      parentDid,
      trustLevel: link?.trustLevel,
      metadata: (link?.metadata as Record<string, any> | null) ?? null,
      createdAt: link?.createdAt?.toISOString(),
      children: children.map((childEdge) =>
        buildNode(childEdge.childDid, childEdge.parentDid, childEdge),
      ),
    };
  };

  const tree = seeds.map((rootDid) => buildNode(rootDid));

  return {
    roots: tree,
    stats: {
      totalLinks: edges.length,
      totalRoots: tree.length || roots.length || (edges.length ? 1 : 0),
      lastUpdated: edges[0]?.createdAt?.toISOString(),
    },
  };
}

function deriveIssuerStatus(
  profile: {
    confidence: number;
    monthsInactive: number;
    requiresSecondFactor: boolean;
    temporalStatus?: string;
  },
  breach?: { count: number; blacklisted: boolean },
): 'healthy' | 'warning' | 'critical' | 'blocked' {
  if (breach?.blacklisted) {
    return 'blocked';
  }
  if (profile.requiresSecondFactor || profile.confidence < TRUST_WEIGHT_THRESHOLD) {
    return 'critical';
  }
  if (profile.temporalStatus === 'dormant' || profile.monthsInactive > 18) {
    return 'critical';
  }
  if (profile.temporalStatus === 'stale' || profile.monthsInactive > 12 || (breach?.count ?? 0) > 0) {
    return 'warning';
  }
  return 'healthy';
}

