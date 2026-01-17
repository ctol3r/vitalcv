"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantMtlsConfig = getTenantMtlsConfig;
exports.isDpopRequired = isDpopRequired;
exports.getDpopAlgorithms = getDpopAlgorithms;
function getTenantMtlsConfig(_tenantId) {
    return {
        enabled: process.env.MTLS_ENABLED === 'true',
        allowed_for_confidential: process.env.MTLS_ALLOWED_FOR_CONFIDENTIAL !== 'false',
    };
}
function isDpopRequired() {
    return process.env.DPOP_REQUIRED !== 'false';
}
function getDpopAlgorithms() {
    const envValue = process.env.DPOP_ALGORITHMS || process.env.DPOP_ALGS;
    if (!envValue) {
        return ['EdDSA', 'ES256'];
    }
    return envValue
        .split(',')
        .map((alg) => alg.trim())
        .filter(Boolean);
}
