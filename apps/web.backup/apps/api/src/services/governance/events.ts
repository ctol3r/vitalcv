import { EventEmitter } from 'events';
import type {
  ConfigChangeSet,
  GovernanceProposalChainState,
  GovernanceProposalStatus,
  GovernanceVoteOption,
} from '@/lib/governance/types';
import { ChainClient } from '../chain/client';
import { getServiceLogger } from '../../../../../services/logging/serviceLogger';

export const GOVERNANCE_EVENTS = {
  PROPOSAL_CREATED: 'proposalCreated',
  VOTE_CAST: 'voteCast',
  PROPOSAL_EXECUTED: 'proposalExecuted',
} as const;

export interface ProposalCreatedEvent {
  proposalId: string;
  proposerDid: string;
  title: string;
  changeSet?: ConfigChangeSet;
  createdAt: string;
}

export interface VoteCastEvent {
  proposalId: string;
  voterDid: string;
  vote: GovernanceVoteOption;
  chainState?: GovernanceProposalChainState | null;
  castAt: string;
}

export interface ProposalExecutedEvent {
  proposalId: string;
  result: GovernanceProposalStatus;
  changeSet?: ConfigChangeSet;
  executedAt?: string;
}

type GovernanceEventPayloads = {
  [GOVERNANCE_EVENTS.PROPOSAL_CREATED]: ProposalCreatedEvent;
  [GOVERNANCE_EVENTS.VOTE_CAST]: VoteCastEvent;
  [GOVERNANCE_EVENTS.PROPOSAL_EXECUTED]: ProposalExecutedEvent;
};

class GovernanceEventBus extends EventEmitter {
  emit<TEvent extends keyof GovernanceEventPayloads>(
    event: TEvent,
    payload: GovernanceEventPayloads[TEvent],
  ): boolean {
    return super.emit(event, payload);
  }

  on<TEvent extends keyof GovernanceEventPayloads>(
    event: TEvent,
    listener: (payload: GovernanceEventPayloads[TEvent]) => void,
  ): this {
    return super.on(event, listener);
  }
}

export const governanceEvents = new GovernanceEventBus();

const chainClient = new ChainClient();
const log = getServiceLogger('api/services/governance/events');

governanceEvents.on(GOVERNANCE_EVENTS.PROPOSAL_EXECUTED, async (payload) => {
  try {
    await chainClient.submitAuditEvent({
      eventType: 'governanceDecision',
      payload: {
        proposalId: payload.proposalId,
        result: payload.result,
        changedParams: payload.changeSet?.params ?? {},
        executedAt: payload.executedAt ?? new Date().toISOString(),
      },
      tags: ['governance', payload.result, 'decision'],
    });
  } catch (error) {
    log.error('Failed to anchor governance decision digest', {
      proposalId: payload.proposalId,
      error: error instanceof Error ? error.message : error,
    });
  }
});


