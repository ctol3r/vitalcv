"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredentialContext = getCredentialContext;
exports.requestCredential = requestCredential;
exports.verifyCredential = verifyCredential;
exports.revokeCredential = revokeCredential;
exports.issueCredential = issueCredential;
exports.signCredential = signCredential;
const credential_registry_1 = require("../credential_registry");
const polkadot_service_1 = require("../blockchain/polkadot_service");
const audit_scrapbook_1 = require("../blockchain/audit_scrapbook");
const biometric_auth_1 = require("../utils/biometric_auth");
// credential_controller.ts - demonstrates how the credential registry pallet
// integrates the W3C VC Data Model 1.0 schema.
const polkadot = new polkadot_service_1.PolkadotService();
const scrapbook = new audit_scrapbook_1.AuditScrapbook(polkadot);
let credentials = {};
let nextId = 1;
function getCredentialContext() {
    return (0, credential_registry_1.loadVcContext)();
}
function requestCredential(data) {
    const id = String(nextId++);
    const credential = { id, data, status: 'requested' };
    credentials[id] = credential;
    return credential;
}
function verifyCredential(id) {
    const credential = credentials[id];
    if (!credential) {
        throw new Error('Credential not found');
    }
    credential.status = 'verified';
    return credential;
}
function revokeCredential(id) {
    const credential = credentials[id];
    if (!credential) {
        throw new Error('Credential not found');
    }
    credential.status = 'revoked';
    return credential;
}
async function issueCredential(userId, credential) {
    // Placeholder for logic that would issue a credential
    await scrapbook.recordIdentityAction(userId, 'ISSUE_CREDENTIAL');
    return { userId, credential };
}
/**
 * Signs a verifiable credential after confirming device biometrics.
 * This is a stub implementation for the Chai VC platform.
 */
async function signCredential(vcData) {
    const confirmed = await (0, biometric_auth_1.confirmBiometric)();
    if (!confirmed) {
        throw new Error('Biometric confirmation failed');
    }
    // TODO: integrate actual VC signing logic here
    console.log('VC signed');
    return vcData;
}
