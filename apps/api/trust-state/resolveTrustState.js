"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTrustState = resolveTrustState;
const trust_state_1 = require("../../../packages/trust-state");
async function resolveTrustState(clinician_id, deps) {
    const resolver = new trust_state_1.TrustStateResolver(deps);
    return resolver.resolve(clinician_id);
}
