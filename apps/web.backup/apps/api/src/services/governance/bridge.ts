import { PrismaClient } from '@prisma/client';
import type {
  ConfigChangeSet,
  ConfigChangeType,
  GovernanceProposalChainState,
  GovernanceProposalStatus,
  GovernanceProposalView,
  GovernanceTimelineEvent,
  GovernanceVoteOption,
} from '@/lib/governance/types';
import { ChainClient } from '../chain/client';
import { governanceEvents, GOVERNANCE_EVENTS } from './events';
import { getServiceLogger } from '../../../../../services/logging/serviceLogger';

export interface SubmitProposalInput {
  proposerDid: string;
  title: string;
  description: string;
  changeSet: ConfigChangeSet;
}

export interface CastVoteInput {
  proposalId: string;
  voterDid: string;
  vote: GovernanceVoteOption;
}

const prisma = new PrismaClient();
const chainClient = new ChainClient();
const log = getServiceLogger('api/services/governance/bridge');

const ALLOWED_CHANGE_TYPES: ConfigChangeType[] = [
  'blockTimeTuning',
  'validatorWeights',
  'auditRetentionPolicies',
];

export class GovernanceGuardrailError extends Error {
  constructor(
    public readonly code: 'security_weakened' | 'audit_anchor_disabled' | 'revocation_bypassed' | 'invalid_change_set',
    message: string,
  ) {
    super(message);
    this.name = 'GovernanceGuardrailError';
  }
}

export async function submitProposal(input: SubmitProposalInput): Promise<GovernanceProposalView> {
  ensureAllowedChangeSet(input.changeSet);

  const record = await prisma.governanceProposal.create({
    data: {
      proposerDid: input.proposerDid,
      title: input.title,
      description: input.description,
      status: 'draft',
    },
  });

  governanceEvents.emit(GOVERNANCE_EVENTS.PROPOSAL_CREATED, {
    proposalId: record.id,
    proposerDid: input.proposerDid,
    title: input.title,
    changeSet: input.changeSet,
    createdAt: record.createdAt.toISOString(),
  });

  try {
    await chainClient.submitGovernanceProposal({
      proposalId: record.id,
      proposerDid: input.proposerDid,
      title: input.title,
      description: input.description,
      changeSet: input.changeSet,
    });
  } catch (error) {
    log.warn('Chain governance submission failed, continuing with optimistic state', {
      proposalId: record.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  const chainState = await chainClient.queryGovernanceProposal(record.id);
  const nextStatus = chainState?.status ?? 'active';
  const updated =
    nextStatus !== record.status
      ? await prisma.governanceProposal.update({
          where: { id: record.id },
          data: { status: nextStatus },
        })
      : record;

  return buildProposalView(updated, chainState);
}

export async function castVote(input: CastVoteInput): Promise<GovernanceProposalView> {
  const proposal = await prisma.governanceProposal.findUnique({
    where: { id: input.proposalId },
  });

  if (!proposal) {
    throw new Error('proposal_not_found');
  }

  await chainClient.castGovernanceVote({
    proposalId: proposal.id,
    voter: input.voterDid,
    vote: input.vote,
  });

  const chainState = await chainClient.queryGovernanceProposal(proposal.id);
  const nextStatus = chainState?.status ?? proposal.status;
  const updated =
    nextStatus !== proposal.status
      ? await prisma.governanceProposal.update({
          where: { id: proposal.id },
          data: { status: nextStatus },
        })
      : proposal;

  governanceEvents.emit(GOVERNANCE_EVENTS.VOTE_CAST, {
    proposalId: proposal.id,
    voterDid: input.voterDid,
    vote: input.vote,
    chainState,
    castAt: new Date().toISOString(),
  });

  if (chainState?.status === 'executed') {
    governanceEvents.emit(GOVERNANCE_EVENTS.PROPOSAL_EXECUTED, {
      proposalId: proposal.id,
      result: chainState.status,
      changeSet: chainState.changeSet,
      executedAt: chainState.executedAt ?? new Date().toISOString(),
    });
  }

  return buildProposalView(updated, chainState);
}

export async function queryProposal(proposalId: string): Promise<GovernanceProposalView> {
  const proposal = await prisma.governanceProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new Error('proposal_not_found');
  }

  const chainState = await chainClient.queryGovernanceProposal(proposal.id);
  return buildProposalView(proposal, chainState);
}

export async function listProposals(limit = 50): Promise<GovernanceProposalView[]> {
  const proposals = await prisma.governanceProposal.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const chainStates = await Promise.all(
    proposals.map((proposal) => chainClient.queryGovernanceProposal(proposal.id)),
  );

  return proposals.map((proposal, index) => buildProposalView(proposal, chainStates[index]));
}

export function buildGovernanceTimeline(
  proposals: GovernanceProposalView[],
): GovernanceTimelineEvent[] {
  const events: GovernanceTimelineEvent[] = [];
  for (const proposal of proposals) {
    events.push({
      id: `${proposal.id}-created`,
      proposalId: proposal.id,
      type: 'proposalCreated',
      label: proposal.title,
      description: proposal.description,
      actor: proposal.proposerDid,
      at: proposal.createdAt,
    });

    const chain = proposal.chain;
    if (chain) {
      events.push({
        id: `${proposal.id}-votes`,
        proposalId: proposal.id,
        type: 'voteCast',
        label: 'Votes tallied',
        description: `${chain.yesVotes} yes / ${chain.noVotes} no / ${chain.abstainVotes} abstain`,
        at: chain.lastUpdated,
        metadata: {
          yes: chain.yesVotes,
          no: chain.noVotes,
          abstain: chain.abstainVotes,
          approvals: chain.approvals,
          threshold: chain.threshold,
        },
      });

      if (chain.status === 'executed') {
        events.push({
          id: `${proposal.id}-executed`,
          proposalId: proposal.id,
          type: 'proposalExecuted',
          label: 'Change executed',
          at: chain.executedAt ?? chain.lastUpdated,
          description: 'Multi-sig threshold satisfied and change executed on-chain.',
          metadata: {
            approvals: chain.approvals,
            threshold: chain.threshold,
          },
        });
      } else if (proposal.status !== 'active') {
        events.push({
          id: `${proposal.id}-status`,
          proposalId: proposal.id,
          type: 'statusChanged',
          label: `Status → ${proposal.status}`,
          at: chain.lastUpdated,
          description: `Chain reported status ${proposal.status}.`,
        });
      }
    }
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function buildProposalView(
  proposal: Pick<
    GovernanceProposalView,
    'id' | 'proposerDid' | 'title' | 'description' | 'status'
  > & {
    createdAt: Date;
    updatedAt: Date;
  },
  chainState?: GovernanceProposalChainState | null,
): GovernanceProposalView {
  return {
    id: proposal.id,
    proposerDid: proposal.proposerDid,
    title: proposal.title,
    description: proposal.description,
    status: proposal.status as GovernanceProposalStatus,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
    chain: chainState ?? undefined,
  };
}

function ensureAllowedChangeSet(changeSet: ConfigChangeSet): void {
  if (!ALLOWED_CHANGE_TYPES.includes(changeSet.type)) {
    throw new GovernanceGuardrailError(
      'invalid_change_set',
      `Change type ${changeSet.type} is not supported`,
    );
  }

  assertGovernanceGuardrails(changeSet);

  switch (changeSet.type) {
    case 'blockTimeTuning': {
      const { targetMilliseconds, minMilliseconds, maxMilliseconds } = changeSet.params;
      if (!(targetMilliseconds >= 250 && targetMilliseconds <= 12000)) {
        throw new GovernanceGuardrailError(
          'invalid_change_set',
          'Block time targets must be between 250ms and 12s',
        );
      }
      if (
        (minMilliseconds && minMilliseconds > targetMilliseconds) ||
        (maxMilliseconds && maxMilliseconds < targetMilliseconds)
      ) {
        throw new GovernanceGuardrailError(
          'invalid_change_set',
          'Min/max block time bounds must encompass the target',
        );
      }
      break;
    }
    case 'validatorWeights': {
      const totalWeight = changeSet.params.weights.reduce((sum, entry) => sum + entry.weight, 0);
      if (totalWeight <= 0) {
        throw new GovernanceGuardrailError(
          'invalid_change_set',
          'Validator weights must include at least one positive allocation',
        );
      }
      if (changeSet.params.weights.some((entry) => entry.weight <= 0)) {
        throw new GovernanceGuardrailError(
          'invalid_change_set',
          'Validator weight entries must be positive',
        );
      }
      break;
    }
    case 'auditRetentionPolicies': {
      const { retentionDays, anchorEveryMinutes } = changeSet.params;
      if (retentionDays < 30) {
        throw new GovernanceGuardrailError(
          'invalid_change_set',
          'Audit retention must be at least 30 days',
        );
      }
      if (anchorEveryMinutes !== undefined && (anchorEveryMinutes <= 0 || anchorEveryMinutes > 720)) {
        throw new GovernanceGuardrailError(
          'invalid_change_set',
          'Audit anchoring interval must be between 1 and 720 minutes',
        );
      }
      break;
    }
    default:
      break;
  }
}

function assertGovernanceGuardrails(changeSet: ConfigChangeSet): void {
  if (changeSet.impact?.securityPolicy === 'relaxed') {
    throw new GovernanceGuardrailError(
      'security_weakened',
      'Governance cannot relax core security policies',
    );
  }

  if (
    changeSet.impact?.auditAnchoring === 'disabled' ||
    (changeSet.type === 'auditRetentionPolicies' &&
      changeSet.params.anchorEveryMinutes !== undefined &&
      changeSet.params.anchorEveryMinutes <= 0)
  ) {
    throw new GovernanceGuardrailError(
      'audit_anchor_disabled',
      'Audit anchoring must remain enabled',
    );
  }

  if (changeSet.impact?.revocationChecks === 'bypass') {
    throw new GovernanceGuardrailError(
      'revocation_bypassed',
      'Revocation safeguards cannot be bypassed',
    );
  }
}










