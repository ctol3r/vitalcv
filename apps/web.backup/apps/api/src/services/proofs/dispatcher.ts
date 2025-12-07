import { randomUUID } from 'crypto';
import type { ProofVerificationResult } from '../verify/types';
import { validateSdJwtProof } from '../verify/validator';
import { verifyBbsProof, type BbsProofPresentation } from '../credentials/bbs';
import { anchorEvent } from '../audit/anchor';
import { proofQueue, type ProofQueueResult } from './queue';
import {
  buildProofGraph,
  type ChainProofPayload,
  type ProofCredential,
  type ProofGraph,
  type ProofGraphNode,
  type ProofJobPriority,
} from './graph';
import { appendProofEvent, type ProofStreamStatus } from './stream';
import type { ProofWorker } from './queue';
import { getPublicJwksPayload } from '../../../../services/identity/signingKeyProvider';
import { isTrusted } from '../trust/registry';

interface DispatchContext {
  threadId: string;
  presentationId: string;
  credentials: ProofCredential[];
  chainProof?: ChainProofPayload | null;
  priority?: ProofJobPriority;
  expectedNonce?: string;
  bbsPresentation?: BbsProofPresentation | null;
  issuerDid?: string;
  dpopJkt?: string;
  source?: string;
}

export interface ProofDispatchReceipt {
  threadId: string;
  status: 'accepted' | 'rejected';
  enqueuedAt: string;
  summary: {
    status: ProofStreamStatus;
    eventCount: number;
    lastEvent: string;
    lastEventAt: string;
  };
}

const sdJwtWorker: ProofWorker = async ({ payload }) => {
  try {
    const result = await validateSdJwtProof({
      token: payload.token,
      disclosures: payload.disclosures,
      revealGroups: payload.revealGroups,
      expectedNonce: payload.expectedNonce,
    });
    if (!result.valid) {
      return {
        status: 'failed',
        error: result.reason ?? 'sd-jwt_invalid',
        output: result,
        warnings: result.warnings,
      };
    }
    return {
      status: 'success',
      output: result,
      warnings: result.warnings,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'sd-jwt_worker_failed',
    };
  }
};

const bbsPlusWorker: ProofWorker = async ({ payload }) => {
  if (!payload.presentation) {
    return {
      status: 'skipped',
      warnings: ['bbs_presentation_missing'],
    };
  }
  try {
    const valid = await verifyBbsProof(payload.presentation as BbsProofPresentation, payload.expectedNonce);
    if (!valid) {
      return {
        status: 'failed',
        error: 'bbs_proof_invalid',
      };
    }
    return {
      status: 'success',
      output: { verified: true },
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'bbs_worker_failed',
    };
  }
};

const vpChainWorker: ProofWorker = async ({ payload }) => {
  const chainProof: ChainProofPayload | undefined = payload.chainProof;
  if (!chainProof?.blockHash) {
    return {
      status: 'skipped',
      warnings: ['chain_proof_missing'],
    };
  }
  if (!Array.isArray(chainProof.merklePath) || chainProof.merklePath.length === 0) {
    return {
      status: 'failed',
      error: 'merkle_path_empty',
    };
  }
  const normalizedHash = normalizeHash(chainProof.blockHash);
  if (!normalizedHash) {
    return {
      status: 'failed',
      error: 'invalid_block_hash',
    };
  }
  return {
    status: 'success',
    output: {
      blockHash: normalizedHash,
      pathLength: chainProof.merklePath.length,
      anchorId: chainProof.anchorId,
    },
  };
};

proofQueue.registerWorker('sd-jwt', sdJwtWorker);
proofQueue.registerWorker('bbs+', bbsPlusWorker);
proofQueue.registerWorker('vp-chain-check', vpChainWorker);

export async function dispatchProofBundle(context: DispatchContext): Promise<ProofDispatchReceipt> {
  const threadId = context.threadId || randomUUID();
  const enqueuedAt = new Date().toISOString();

  await appendProofEvent(threadId, 'request', {
    presentationId: context.presentationId,
    issuerDid: context.issuerDid,
    priority: context.priority ?? 'standard',
    source: context.source ?? 'verifier-api',
  });

  const graph = buildProofGraph({
    threadId,
    credentials: context.credentials,
    chainProof: context.chainProof,
    bbsPresentation: context.bbsPresentation ?? null,
    priority: context.priority,
    expectedNonce: context.expectedNonce,
    context: {
      issuerDid: context.issuerDid,
    },
  });

  await appendProofEvent(threadId, 'bundleOptimized', graph.metadata.optimizedBundle);
  const graphReadyAt = new Date().toISOString();
  await appendProofEvent(threadId, 'graphReady', {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      worker: node.worker,
      priority: node.priority,
    })),
  });

  void runGraphExecution(context, graph).catch((error) => {
    console.error('[proofs][dispatcher] pipeline crashed', error);
  });

  return {
    threadId,
    status: 'accepted',
    enqueuedAt,
    summary: {
      status: 'pending',
      eventCount: 3,
      lastEvent: 'graphReady',
      lastEventAt: graphReadyAt,
    },
  };
}

async function runGraphExecution(context: DispatchContext, graph: ProofGraph) {
  if (!graph.nodes.length) {
    await appendProofEvent(context.threadId, 'validated', {
      status: 'warning',
      reason: 'no_workers_registered',
    });
    await anchorCheckpoint(context, {
      status: 'warning',
      checks: [],
      eventCount: 0,
    });
    return;
  }

  const pending = new Map<string, ProofGraphNode>(graph.nodes.map((node) => [node.id, node]));
  const completed = new Map<string, ProofQueueResult>();

  while (pending.size) {
    const ready = Array.from(pending.values()).filter((node) =>
      node.dependsOn.every((dep) => completed.has(dep)),
    );

    if (!ready.length) {
      console.warn('[proofs][dispatcher] graph deadlock', pending.keys());
      await appendProofEvent(context.threadId, 'error', {
        message: 'Graph deadlock detected',
      });
      return;
    }

    const results = await Promise.all(
      ready.map(async (node) => {
        const result = await proofQueue.enqueue({
          threadId: context.threadId,
          worker: node.worker,
          payload: node.payload,
          priority: node.priority,
        });
        return { node, result };
      }),
    );

    for (const entry of results) {
      completed.set(entry.node.id, entry.result);
      pending.delete(entry.node.id);
      if (entry.result.status === 'failed') {
        await appendProofEvent(context.threadId, 'error', {
          worker: entry.node.worker,
          stage: entry.node.id,
          error: entry.result.error,
        });
        return;
      }
    }
  }

  const crossCheck = await runSignatureCrossChecks(context, graph, completed);
  await appendProofEvent(context.threadId, 'validated', crossCheck);
  await anchorCheckpoint(context, crossCheck);
}

async function runSignatureCrossChecks(
  context: DispatchContext,
  graph: ProofGraph,
  results: Map<string, ProofQueueResult>,
) {
  const sdJwtResults = Array.from(results.values()).filter((entry) => entry.worker === 'sd-jwt');
  const chainResult = Array.from(results.values()).find((entry) => entry.worker === 'vp-chain-check');

  const issuerKid =
    graph.metadata.crossCheckPlan.issuerKids[0] ??
    sdJwtResults
      .map((entry) => (entry.output as ProofVerificationResult | undefined)?.issuer?.kid)
      .find((kid): kid is string => Boolean(kid));

  const issuerTrusted = context.issuerDid ? await isTrusted(context.issuerDid) : true;
  const trustKeys = await getPublicJwksPayload().catch(() => ({ keys: [], version: 'n/a' }));

  const checks = [
    {
      name: 'issuerKey',
      passed: Boolean(issuerKid),
      detail: issuerKid ?? 'issuer_kid_missing',
    },
    {
      name: 'chainKey',
      passed: chainResult?.status === 'success',
      detail: chainResult?.output?.blockHash ?? 'chain_proof_missing',
    },
    {
      name: 'trustRegistryKey',
      passed: issuerKid
        ? Boolean(trustKeys.keys.find((key) => key.kid === issuerKid && key.status === 'active'))
        : false,
      detail: issuerTrusted ? 'registry_consistent' : 'issuer_not_trusted',
    },
  ];

  const failedChecks = checks.filter((check) => !check.passed);
  const status: ProofStreamStatus =
    failedChecks.length === 0 ? 'validated' : failedChecks.length === checks.length ? 'error' : 'pending';

  return {
    status,
    issuerDid: context.issuerDid,
    eventCount: results.size,
    checks,
    trustRegistryVersion: trustKeys.version,
  };
}

async function anchorCheckpoint(
  context: DispatchContext,
  summary: { status: ProofStreamStatus; checks: Array<Record<string, any>>; eventCount: number },
) {
  const checkpoint = anchorEvent('proofStreamCheckpoint', {
    threadId: context.threadId,
    presentationId: context.presentationId,
    issuerDid: context.issuerDid,
    status: summary.status,
    eventCount: summary.eventCount,
  });

  await appendProofEvent(context.threadId, 'anchored', {
    anchorId: checkpoint.id,
    txHash: checkpoint.txHash,
    blockHash: checkpoint.blockHash,
    network: checkpoint.network,
    merklePath: checkpoint.merklePath,
    checks: summary.checks,
  });
}

function normalizeHash(value: string | undefined): string | null {
  if (!value) return null;
  const lowercase = value.startsWith('0x') ? value.toLowerCase() : `0x${value.toLowerCase()}`;
  return /^0x[0-9a-f]+$/.test(lowercase) ? lowercase : null;
}

