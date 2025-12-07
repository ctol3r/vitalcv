"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.governance = void 0;
exports.submitGovernanceProposal = submitGovernanceProposal;
const governance_1 = require("./governance");
// Default economic parameters for the platform.
const defaultParameters = {
    interestRate: 0.05,
    inflationRate: 0.02,
};
// Export a singleton governance instance that can be used by other modules.
exports.governance = new governance_1.Governance(defaultParameters);
function submitGovernanceProposal(proposer, params) {
    return exports.governance.proposeChange(proposer, params);
}
