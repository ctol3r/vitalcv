import { createHash, randomUUID } from 'crypto';
import type {
  ConfigChangeSet,
  GovernanceProposalChainState,
  GovernanceVoteOption,
} from '@/lib/governance/types';

export interface ChainClientOptions {
  rpcUrl?: string;
  requestTimeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ChainReceipt {
  txHash: string;
  blockNumber?: number;
  timestamp: string;
  raw?: unknown;
}

export interface AuditScrapbookRecord {
  eventType: string;
  payload: Record<string, unknown>;
  tags?: string[];
  correlationId?: string;
}

export interface BatchCommitPayload {
  merkleRoot: string;
  entryCount: number;
  entries: Array<{
    type: 'issuance' | 'verification' | 'psv';
    hash: string;
    metadata?: Record<string, unknown>;
  }>;
  committedAt: string;
}

export interface StatusListEntry {
  index: number;
  page: number;
  revoked: boolean;
  updatedAt: string;
}

export interface StatusListPageSnapshot {
  page: number;
  bits: string;
  updatedAt: string;
}

export interface TrustLinkRecord {
  npi: string;
  did: string;
  jurisdiction?: string;
  nppesHash: string;
  anchoredAt?: string;
}

export interface CredentialStateRecord {
  credentialId: string;
  status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' | 'EXPIRED';
  holder: string;
  lastUpdated: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventRecord {
  id: string;
  eventType: string;
  payloadHash: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface ValidatorNodeHealth {
  id: string;
  name: string;
  peers: number;
  finalityLag: number;
  status: 'active' | 'syncing' | 'degraded';
  lastSeen: string;
}

export interface ValidatorHealthOverview {
  blockHeight: number;
  finalizedHeight: number;
  peers: number;
  syncStatus: 'synced' | 'syncing' | 'degraded';
  finalityLag: number;
  validators: ValidatorNodeHealth[];
  generatedAt: string;
}

export interface GovernanceProposalSubmitPayload {
  proposalId: string;
  proposerDid: string;
  title: string;
  description: string;
  changeSet: ConfigChangeSet;
}

export interface GovernanceVotePayload {
  proposalId: string;
  voter: string;
  vote: GovernanceVoteOption;
}

const DEFAULT_RPC_URL = process.env.SUBSTRATE_RPC_URL ?? 'http://localhost:9933';
const DEFAULT_TIMEOUT = 8_000;
const GOVERNANCE_THRESHOLD = Number(process.env.GOVERNANCE_EXECUTION_THRESHOLD ?? 3);

const GOVERNANCE_CACHE = new Map<string, GovernanceProposalChainState>();

export class ChainClient {
  private readonly rpcUrl: string;
  private readonly timeout: number;
  private readonly headers?: Record<string, string>;

  constructor(options: ChainClientOptions = {}) {
    this.rpcUrl = options.rpcUrl ?? DEFAULT_RPC_URL;
    this.timeout = options.requestTimeoutMs ?? DEFAULT_TIMEOUT;
    this.headers = options.headers;
  }

  async submitGovernanceProposal(payload: GovernanceProposalSubmitPayload): Promise<ChainReceipt> {
    try {
      const result = await this.sendRpc('governance_submitProposal', [payload]);
      this.upsertGovernanceCache({
        proposalId: payload.proposalId,
        status: 'active',
        yesVotes: 0,
        noVotes: 0,
        abstainVotes: 0,
        approvals: 0,
        threshold: GOVERNANCE_THRESHOLD,
        changeSet: payload.changeSet,
        lastUpdated: new Date().toISOString(),
      });
      return this.coerceReceipt(result, payload);
    } catch (error) {
      console.warn('[ChainClient] governance_submitProposal failed, caching locally', error);
      this.upsertGovernanceCache({
        proposalId: payload.proposalId,
        status: 'active',
        yesVotes: 0,
        noVotes: 0,
        abstainVotes: 0,
        approvals: 0,
        threshold: GOVERNANCE_THRESHOLD,
        changeSet: payload.changeSet,
        lastUpdated: new Date().toISOString(),
      });
      return this.buildLocalReceipt(payload);
    }
  }

  async castGovernanceVote(payload: GovernanceVotePayload): Promise<ChainReceipt> {
    try {
      const result = await this.sendRpc('governance_castVote', [payload]);
      this.applyGovernanceVote(payload);
      return this.coerceReceipt(result, payload);
    } catch (error) {
      console.warn('[ChainClient] governance_castVote failed, applying vote locally', error);
      this.applyGovernanceVote(payload);
      return this.buildLocalReceipt(payload);
    }
  }

  async queryGovernanceProposal(proposalId: string): Promise<GovernanceProposalChainState | null> {
    try {
      const result = await this.sendRpc('governance_queryProposal', [proposalId]);
      if (result) {
        const parsed = this.coerceGovernanceState(result, proposalId);
        GOVERNANCE_CACHE.set(proposalId, parsed);
        return parsed;
      }
    } catch (error) {
      console.warn('[ChainClient] governance_queryProposal fallback to cache', error);
    }
    return GOVERNANCE_CACHE.get(proposalId) ?? null;
  }

  async submitAuditEvent(record: AuditScrapbookRecord): Promise<ChainReceipt> {
    try {
      const result = await this.sendRpc('auditScrapbook_record', [record]);
      return this.coerceReceipt(result, record);
    } catch (error) {
      console.warn('[ChainClient] auditScrapbook_record failed, falling back to local receipt', error);
      return this.buildLocalReceipt(record);
    }
  }

  async commitBatchRoot(payload: BatchCommitPayload): Promise<ChainReceipt> {
    try {
      const result = await this.sendRpc('auditBatch_commit', [payload]);
      return this.coerceReceipt(result, payload);
    } catch (error) {
      console.warn('[ChainClient] auditBatch_commit failed, falling back to local receipt', error);
      return this.buildLocalReceipt(payload);
    }
  }

  async getStatusAt(index: number): Promise<StatusListEntry> {
    try {
      const result = await this.sendRpc('statusList_getStatus', [index]);
      return {
        index,
        page: result?.page ?? Math.floor(index / 256),
        revoked: Boolean(result?.revoked),
        updatedAt: typeof result?.updatedAt === 'string' ? result.updatedAt : new Date().toISOString(),
      };
    } catch (error) {
      console.warn('[ChainClient] statusList_getStatus failed, defaulting to not revoked', error);
      return {
        index,
        page: Math.floor(index / 256),
        revoked: false,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async resolveTrustLink(npi: string, jurisdiction?: string): Promise<TrustLinkRecord | null> {
    try {
      const result = await this.sendRpc('trustLink_resolve', [npi, jurisdiction]);
      if (!result) return null;
      return {
        npi,
        did: result.did,
        jurisdiction: result.jurisdiction ?? jurisdiction,
        nppesHash: result.nppesHash,
        anchoredAt: typeof result.anchoredAt === 'string' ? result.anchoredAt : new Date().toISOString(),
      };
    } catch (error) {
      console.warn('[ChainClient] trustLink_resolve failed', error);
      return null;
    }
  }

  async fetchCredentialStates(): Promise<CredentialStateRecord[]> {
    try {
      const result = await this.sendRpc('credentialRegistry_snapshot');
      if (Array.isArray(result)) {
        return result.map((entry) => ({
          credentialId: entry.credentialId ?? entry.id ?? randomUUID(),
          status: entry.status ?? 'ACTIVE',
          holder: entry.holder ?? entry.subject ?? 'unknown',
          lastUpdated:
            typeof entry.lastUpdated === 'string'
              ? entry.lastUpdated
              : new Date().toISOString(),
          metadata: entry.metadata ?? undefined,
        }));
      }
    } catch (error) {
      console.warn('[ChainClient] credentialRegistry_snapshot failed', error);
    }
    return [];
  }

  async fetchRevocationSnapshot(): Promise<StatusListPageSnapshot[]> {
    try {
      const result = await this.sendRpc('statusList_snapshot');
      if (Array.isArray(result)) {
        return result.map((page) => ({
          page: page.page ?? 0,
          bits: page.bits ?? '',
          updatedAt: typeof page.updatedAt === 'string' ? page.updatedAt : new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.warn('[ChainClient] statusList_snapshot failed', error);
    }

    return [];
  }

  async fetchRecentAuditEvents(sinceIso: string): Promise<AuditEventRecord[]> {
    try {
      const result = await this.sendRpc('auditScrapbook_recent', [sinceIso]);
      if (Array.isArray(result)) {
        return result.map((entry) => ({
          id: entry.id ?? randomUUID(),
          eventType: entry.eventType ?? 'unknown',
          payloadHash: entry.payloadHash ?? this.hashPayload(entry.payload ?? entry.eventType ?? ''),
          payload: entry.payload ?? {},
          timestamp:
            typeof entry.timestamp === 'string'
              ? entry.timestamp
              : new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.warn('[ChainClient] auditScrapbook_recent failed', error);
    }

    return [];
  }

  async fetchValidatorHealth(): Promise<ValidatorHealthOverview> {
    try {
      const [health, bestHeader, finalizedHash] = await Promise.all([
        this.sendRpc('system_health'),
        this.sendRpc('chain_getHeader'),
        this.sendRpc('chain_getFinalizedHead'),
      ]);

      const finalizedHeader = finalizedHash
        ? await this.sendRpc('chain_getHeader', [finalizedHash])
        : null;

      const bestHeight = parseBlockNumber(bestHeader);
      const finalizedHeight = parseBlockNumber(finalizedHeader);
      const peers = Number(health?.peers ?? 0);
      const finalityLag = Math.max(0, bestHeight - finalizedHeight);
      const syncStatus: ValidatorHealthOverview['syncStatus'] =
        health?.isSyncing ? 'syncing' : finalityLag > 12 ? 'degraded' : 'synced';

      return {
        blockHeight: bestHeight,
        finalizedHeight,
        peers,
        syncStatus,
        finalityLag,
        validators: buildSyntheticValidators(peers, finalityLag, syncStatus),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('[ChainClient] fetchValidatorHealth failed', error);
      return {
        blockHeight: 0,
        finalizedHeight: 0,
        peers: 0,
        syncStatus: 'degraded',
        finalityLag: 0,
        validators: buildSyntheticValidators(0, 0, 'degraded'),
        generatedAt: new Date().toISOString(),
      };
    }
  }

  private async sendRpc(method: string, params: unknown[] = []): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`ChainClient RPC failed with status ${response.status}`);
      }

      const payload = await response.json();
      if (payload.error) {
        throw new Error(payload.error.message ?? `RPC ${method} failed`);
      }

      return payload.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private coerceReceipt(result: any, payload: unknown): ChainReceipt {
    if (result && typeof result === 'object') {
      return {
        txHash: result.txHash ?? result.extrinsicHash ?? this.hashPayload(payload),
        blockNumber: result.blockNumber ?? result.block ?? undefined,
        timestamp:
          typeof result.timestamp === 'string'
            ? result.timestamp
            : new Date().toISOString(),
        raw: result,
      };
    }

    return this.buildLocalReceipt(payload);
  }

  private buildLocalReceipt(payload: unknown): ChainReceipt {
    return {
      txHash: this.hashPayload(payload),
      blockNumber: undefined,
      timestamp: new Date().toISOString(),
      raw: { emulated: true },
    };
  }

  private hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private upsertGovernanceCache(state: GovernanceProposalChainState): void {
    GOVERNANCE_CACHE.set(state.proposalId, state);
  }

  private applyGovernanceVote(payload: GovernanceVotePayload): void {
    const cached = GOVERNANCE_CACHE.get(payload.proposalId) ?? {
      proposalId: payload.proposalId,
      status: 'active' as GovernanceProposalChainState['status'],
      yesVotes: 0,
      noVotes: 0,
      abstainVotes: 0,
      approvals: 0,
      threshold: GOVERNANCE_THRESHOLD,
      lastUpdated: new Date().toISOString(),
    };

    switch (payload.vote) {
      case 'yes':
        cached.yesVotes += 1;
        break;
      case 'no':
        cached.noVotes += 1;
        break;
      case 'abstain':
        cached.abstainVotes += 1;
        break;
      default:
        break;
    }

    cached.lastUpdated = new Date().toISOString();
    if (cached.yesVotes >= cached.threshold) {
      cached.approvals = cached.threshold;
      if (cached.status !== 'executed') {
        cached.status = 'executed';
        cached.executedAt = new Date().toISOString();
      }
    } else if (cached.noVotes >= cached.threshold) {
      cached.status = 'rejected';
    } else if (cached.yesVotes > cached.noVotes) {
      cached.status = 'accepted';
    } else if (cached.status === 'draft') {
      cached.status = 'active';
    }

    GOVERNANCE_CACHE.set(payload.proposalId, cached);
  }

  private coerceGovernanceState(raw: any, proposalId: string): GovernanceProposalChainState {
    const threshold = Number(raw?.threshold ?? GOVERNANCE_THRESHOLD) || GOVERNANCE_THRESHOLD;
    return {
      proposalId,
      status: this.normalizeGovernanceStatus(raw?.status),
      yesVotes: Number(raw?.yesVotes ?? raw?.votes?.yes ?? 0),
      noVotes: Number(raw?.noVotes ?? raw?.votes?.no ?? 0),
      abstainVotes: Number(raw?.abstainVotes ?? raw?.votes?.abstain ?? 0),
      approvals: Number(raw?.approvals ?? raw?.approvers ?? 0),
      threshold,
      changeSet: raw?.changeSet as ConfigChangeSet | undefined,
      lastUpdated:
        typeof raw?.lastUpdated === 'string' ? raw.lastUpdated : new Date().toISOString(),
      executedAt: typeof raw?.executedAt === 'string' ? raw.executedAt : undefined,
    };
  }

  private normalizeGovernanceStatus(status: unknown): GovernanceProposalChainState['status'] {
    switch (String(status ?? '').toLowerCase()) {
      case 'accepted':
        return 'accepted';
      case 'rejected':
        return 'rejected';
      case 'executed':
        return 'executed';
      case 'draft':
        return 'draft';
      case 'active':
      default:
        return 'active';
    }
  }
}

function parseBlockNumber(header: any): number {
  if (!header) return 0;
  if (typeof header.number === 'string') {
    return parseInt(header.number, 16) || 0;
  }
  if (typeof header.height === 'number') {
    return header.height;
  }
  return 0;
}

function buildSyntheticValidators(
  peers: number,
  finalityLag: number,
  status: ValidatorHealthOverview['syncStatus'],
): ValidatorNodeHealth[] {
  const templates = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  return templates.map((label, index) => {
    const lag = Math.max(0, finalityLag - index);
    const peerCount = Math.max(0, peers - index);
    const nodeStatus: ValidatorNodeHealth['status'] =
      status === 'synced' && lag <= 3
        ? 'active'
        : status === 'syncing'
          ? 'syncing'
          : lag > 5
            ? 'degraded'
            : 'active';

    return {
      id: `validator-${index + 1}`,
      name: `${label} Validator`,
      peers: peerCount,
      finalityLag: lag,
      status: nodeStatus,
      lastSeen: new Date(Date.now() - index * 60_000).toISOString(),
    };
  });
}


