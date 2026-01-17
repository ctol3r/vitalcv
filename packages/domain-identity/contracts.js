"use strict";
/**
 * B196B-CONTRACT-006
 * Identity domain contracts shared across wallet services, VC formats, and agents.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VC_FORMATS = exports.WALLET_SIGNATURE_ALGS = void 0;
// ---------------------------------------------------------------------------
// Wallet device bindings
// ---------------------------------------------------------------------------
exports.WALLET_SIGNATURE_ALGS = ['EdDSA', 'ES256'];
// ---------------------------------------------------------------------------
// Signed Verifiable Credentials
// ---------------------------------------------------------------------------
exports.VC_FORMATS = ['ldp_vc', 'jwt_vc', 'sd_jwt', 'csd_jwt'];
