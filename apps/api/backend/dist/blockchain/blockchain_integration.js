"use strict";
// blockchain_integration.ts - comprehensive blockchain integration for credential validation
// This module integrates the custom multi-token pallet written in Rust, verifier staking, and upgrade paths.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainIntegration = exports.VerifierStakingService = exports.governance = void 0;
exports.initializeIssuerWallet = initializeIssuerWallet;
exports.signWithIssuerWallet = signWithIssuerWallet;
exports.submitGovernanceProposal = submitGovernanceProposal;
exports.getUpgradePath = getUpgradePath;
exports.getOnChainRisk = getOnChainRisk;
exports.checkCredentialStatus = checkCredentialStatus;
const ethers_1 = require("ethers");
const VerifierStaking_json_1 = __importDefault(require("../../contracts/VerifierStaking.json"));
const ethereum_bridge_service_1 = require("./ethereum_bridge_service");
const chainlink_adapter_1 = require("./oracles/chainlink_adapter");
const chainlink_oracle_1 = require("./chainlink_oracle");
const governance_1 = require("./governance");
const upgrade_paths_1 = require("./upgrade_paths");
const hardware_wallet_1 = require("./hardware_wallet");
// Default economic parameters for the platform.
const defaultParameters = {
    interestRate: 0.05,
    inflationRate: 0.02,
};
// Export a singleton governance instance that can be used by other modules.
exports.governance = new governance_1.Governance(defaultParameters);
let issuerWallet = null;
/**
 * Initialize the issuer wallet using hardware-backed storage.
 * Only YubiKey or Ledger devices are supported.
 */
function initializeIssuerWallet(type) {
    issuerWallet = type === 'yubikey' ? new hardware_wallet_1.YubiKeyWallet() : new hardware_wallet_1.LedgerWallet();
}
/**
 * Sign arbitrary data with the issuer's hardware wallet.
 * Throws if the wallet has not been initialized.
 */
async function signWithIssuerWallet(data) {
    if (!issuerWallet) {
        throw new Error('Issuer wallet not initialized. Use a hardware wallet such as YubiKey or Ledger.');
    }
    await issuerWallet.connect();
    return issuerWallet.sign(data);
}
function submitGovernanceProposal(proposer, params) {
    return exports.governance.proposeChange(proposer, params);
}
/**
 * Obtain upgrade paths for the given target platform.
 * This function demonstrates how the backend can prepare
 * migrations for both EVM and WASM targets in a chain-agnostic way.
 */
function getUpgradePath(target, identifier) {
    if (target === 'EVM') {
        return (0, upgrade_paths_1.bridgeToEvmContract)(identifier);
    }
    return (0, upgrade_paths_1.bridgeToWasmContract)(identifier);
}
/**
 * Service for interacting with the VerifierStaking smart contract. This wraps
 * basic staking functionality so the rest of the backend can easily lock tokens
 * for verifiers and slash them if they misbehave.
 */
class VerifierStakingService {
    constructor(address, signer) {
        this.contract = new ethers_1.Contract(address, VerifierStaking_json_1.default, signer);
    }
    /**
     * Stake tokens by sending native currency to the contract.
     */
    async stake(amount) {
        return await this.contract.stake({ value: amount });
    }
    /**
     * Withdraw previously staked tokens.
     */
    async withdraw(amount) {
        return await this.contract.withdraw(amount);
    }
    /**
     * Slash a verifier's stake. Only the contract owner can call this.
     */
    async slash(verifier, amount) {
        return await this.contract.slash(verifier, amount);
    }
}
exports.VerifierStakingService = VerifierStakingService;
/**
 * Comprehensive blockchain integration combining Ethereum bridge,
 * Chainlink oracles, verifier staking, and risk scoring functionality.
 */
class BlockchainIntegration {
    constructor(stakingAddress, signer) {
        this.bridge = new ethereum_bridge_service_1.EthereumBridgeService();
        this.chainlink = new chainlink_adapter_1.ChainlinkAdapter();
        if (stakingAddress && signer) {
            this.stakingService = new VerifierStakingService(stakingAddress, signer);
        }
    }
    /**
     * Validate a credential hash through the Ethereum bridge.
     */
    async validateCredential(hash) {
        return this.bridge.validate(hash);
    }
    async getLicenseStatus(licenseId) {
        return this.chainlink.fetchLicenseStatus(licenseId);
    }
    async getRiskSignals(address) {
        return this.chainlink.fetchRiskSignals(address);
    }
    /**
     * Stake tokens for a verifier.
     */
    async stakeForVerifier(amount) {
        if (!this.stakingService) {
            throw new Error('Staking service not initialized');
        }
        return this.stakingService.stake(amount);
    }
    /**
     * Slash a verifier's stake for misbehavior.
     */
    async slashVerifier(verifier, amount) {
        if (!this.stakingService) {
            throw new Error('Staking service not initialized');
        }
        return this.stakingService.slash(verifier, amount);
    }
}
exports.BlockchainIntegration = BlockchainIntegration;
/**
 * Example blockchain integration utilities.
 * The real implementation would interact with smart contracts and oracles.
 */
async function getOnChainRisk(userId) {
    // Delegate to the Chainlink Functions oracle integration.
    return (0, chainlink_oracle_1.queryRiskScore)(userId);
}
/**
 * Placeholder blockchain check implementation.
 * In a real system this would query the on-chain credential registry.
 */
async function checkCredentialStatus(credentialId) {
    // TODO: Integrate with actual Polkadot or other blockchain service.
    // For now always return 'valid'.
    return 'valid';
}
