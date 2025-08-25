const assert = require('assert');
const { governance, submitGovernanceProposal } = require('../dist/blockchain/blockchain_integration');

// submit a proposal to change the interest rate
const proposal = submitGovernanceProposal('alice', { interestRate: 0.1 });

governance.vote(proposal.id, true);
governance.vote(proposal.id, true);

governance.finalizeProposal(proposal.id);

assert.strictEqual(governance.getCurrentParameters().interestRate, 0.1);
console.log('Governance module test passed');
