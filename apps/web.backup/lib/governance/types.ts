export type GovernanceProposalStatus = 'draft' | 'active' | 'accepted' | 'rejected' | 'executed';

export type GovernanceVoteOption = 'yes' | 'no' | 'abstain';

export type ConfigChangeType = 'blockTimeTuning' | 'validatorWeights' | 'auditRetentionPolicies';

export interface ConfigChangeImpact {
  securityPolicy?: 'strengthened' | 'unchanged' | 'relaxed';
  auditAnchoring?: 'required' | 'optional' | 'disabled';
  revocationChecks?: 'required' | 'optional' | 'bypass';
}

interface ConfigChangeBase<TType extends ConfigChangeType, TParams> {
  type: TType;
  params: TParams;
  impact?: ConfigChangeImpact;
  notes?: string;
}

export type BlockTimeTuningChange = ConfigChangeBase<
  'blockTimeTuning',
  {
    targetMilliseconds: number;
    minMilliseconds?: number;
    maxMilliseconds?: number;
  }
>;

export type ValidatorWeightsChange = ConfigChangeBase<
  'validatorWeights',
  {
    weights: Array<{
      validator: string;
      weight: number;
    }>;
    rebalance?: boolean;
  }
>;

export type AuditRetentionPoliciesChange = ConfigChangeBase<
  'auditRetentionPolicies',
  {
    retentionDays: number;
    coldStorageDays?: number;
    anchorEveryMinutes?: number;
  }
>;

export type ConfigChangeSet =
  | BlockTimeTuningChange
  | ValidatorWeightsChange
  | AuditRetentionPoliciesChange;

export interface GovernanceProposalChainState {
  proposalId: string;
  status: GovernanceProposalStatus;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  approvals: number;
  threshold: number;
  changeSet?: ConfigChangeSet;
  lastUpdated: string;
  executedAt?: string | null;
}

export interface GovernanceProposalView {
  id: string;
  proposerDid: string;
  title: string;
  description: string;
  status: GovernanceProposalStatus;
  createdAt: string;
  updatedAt: string;
  chain?: GovernanceProposalChainState | null;
}

export type GovernanceTimelineEventType =
  | 'proposalCreated'
  | 'voteCast'
  | 'proposalExecuted'
  | 'statusChanged';

export interface GovernanceTimelineEvent {
  id: string;
  proposalId: string;
  type: GovernanceTimelineEventType;
  label: string;
  at: string;
  description?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}










