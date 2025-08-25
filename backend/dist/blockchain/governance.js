"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Governance = void 0;
class Governance {
    constructor(initialParams) {
        this.proposals = [];
        this.currentParameters = initialParams;
    }
    proposeChange(proposer, params) {
        const proposal = {
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
    vote(proposalId, support) {
        const proposal = this.proposals.find(p => p.id === proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        if (support) {
            proposal.votesFor += 1;
        }
        else {
            proposal.votesAgainst += 1;
        }
    }
    finalizeProposal(id) {
        const proposal = this.proposals.find(p => p.id === id);
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        if (!proposal.executed && proposal.votesFor > proposal.votesAgainst) {
            this.currentParameters = Object.assign(Object.assign({}, this.currentParameters), proposal.newParameters);
        }
        proposal.executed = true;
        return this.currentParameters;
    }
    getCurrentParameters() {
        return this.currentParameters;
    }
}
exports.Governance = Governance;
