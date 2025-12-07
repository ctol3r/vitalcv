export interface EconomicParameters {
  interestRate: number;
  inflationRate: number;
}

export interface Proposal {
  id: number;
  proposer: string;
  newParameters: Partial<EconomicParameters>;
  votesFor: number;
  votesAgainst: number;
  executed: boolean;
}

export class Governance {
  private proposals: Proposal[] = [];
  private currentParameters: EconomicParameters;

  constructor(initialParams: EconomicParameters) {
    this.currentParameters = initialParams;
  }

  proposeChange(proposer: string, params: Partial<EconomicParameters>): Proposal {
    const proposal: Proposal = {
      id: this.proposals.length + 1,
      proposer,
      newParameters: params,
      votesFor: 0,
      votesAgainst: 0,
      executed: false
    };
    this.proposals.push(proposal);
    return proposal;
  }

  vote(proposalId: number, support: boolean): void {
    const proposal = this.proposals.find(p => p.id === proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    if (support) {
      proposal.votesFor += 1;
    } else {
      proposal.votesAgainst += 1;
    }
  }

  finalizeProposal(id: number): EconomicParameters {
    const proposal = this.proposals.find(p => p.id === id);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    if (!proposal.executed && proposal.votesFor > proposal.votesAgainst) {
      this.currentParameters = {
        ...this.currentParameters,
        ...proposal.newParameters
      };
    }
    proposal.executed = true;
    return this.currentParameters;
  }

  getCurrentParameters(): EconomicParameters {
    return this.currentParameters;
  }
}
