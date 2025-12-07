//
//  MultiProofValidator.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 3
//  Multi-proof validator supporting W3C JWT-VC, SD-JWT, ISO mDL, BBS+ selective disclosure
//

import Foundation

/// MultiProofValidator - Unified validator for multiple proof formats
public class MultiProofValidator {
    public static let shared = MultiProofValidator()

    private let proofEngine = CredProofEngine.shared
    private let trustKit = VitalCVTrustKit.shared

    private init() {}

    // MARK: - Parallel Verification Pipeline

    /// Validate credential with parallel verification checks
    public func validateCredentialParallel(
        _ credential: VerifiableCredential,
        includeChainCheck: Bool = true
    ) async throws -> ComprehensiveValidationResult {
        // Task 4: Async parallel verification pipeline
        async let proofValidation = proofEngine.validateCredential(credential)
        async let chainValidation = includeChainCheck ? validateChainAnchor(credential: credential) : nil

        let proofResult = try await proofValidation
        let chainResult = await chainValidation

        // Combine results
        let allChecks = proofResult.checks + (chainResult?.checks ?? [])
        let allPassed = allChecks.allSatisfy { $0.passed }

        return ComprehensiveValidationResult(
            valid: allPassed,
            proofFormat: proofResult.format,
            proofChecks: proofResult.checks,
            chainChecks: chainResult?.checks ?? [],
            timestamp: Date()
        )
    }

    // MARK: - Chain Anchor Validation

    private func validateChainAnchor(credential: VerifiableCredential) async -> ChainValidationResult? {
        // Extract chain anchor from proof or credential metadata
        guard let proof = credential.proof,
              let jws = proof.jws else {
            return nil
        }

        // Parse transaction hash from proof (simplified)
        let txHash = String(jws.prefix(66)) // Assume first 66 chars are hash

        do {
            let result = try await trustKit.validateChainAnchor(
                blockNumber: 0, // Would be extracted from proof
                transactionHash: txHash,
                network: "Substrate"
            )

            return ChainValidationResult(
                isValid: result.isValid,
                blockNumber: result.blockNumber,
                transactionHash: result.transactionHash,
                network: result.network,
                confirmations: result.confirmations,
                timestamp: result.timestamp,
                checks: [
                    ProofCheck(name: "Chain Anchor Valid", passed: result.isValid, message: nil),
                    ProofCheck(name: "Confirmations", passed: result.confirmations >= 6, message: "\(result.confirmations) confirmations")
                ]
            )
        } catch {
            return ChainValidationResult(
                isValid: false,
                blockNumber: 0,
                transactionHash: txHash,
                network: "Substrate",
                confirmations: 0,
                timestamp: Date(),
                checks: [
                    ProofCheck(name: "Chain Anchor Valid", passed: false, message: error.localizedDescription)
                ]
            )
        }
    }

    // MARK: - Format-Specific Validation

    /// Validate W3C JWT-VC format
    public func validateJWTVC(_ credential: VerifiableCredential) async throws -> ValidationResult {
        return try await proofEngine.validateJWTVC(credential)
    }

    /// Validate SD-JWT format
    public func validateSDJWT(_ credential: VerifiableCredential) async throws -> ValidationResult {
        return try await proofEngine.validateSDJWT(credential)
    }

    /// Validate BBS+ format
    public func validateBBSPlus(_ credential: VerifiableCredential) async throws -> ValidationResult {
        return try await proofEngine.validateBBSPlus(credential)
    }

    /// Validate ISO mDL format (future)
    public func validateISOMDL(_ credential: VerifiableCredential) async throws -> ValidationResult {
        // Future implementation for ISO mDL
        return ValidationResult(
            valid: false,
            format: .isoMDL,
            checks: [
                ProofCheck(name: "ISO mDL Format", passed: false, message: "ISO mDL validation not yet implemented")
            ]
        )
    }
}

// MARK: - Models

public struct ComprehensiveValidationResult {
    public let valid: Bool
    public let proofFormat: ProofFormat
    public let proofChecks: [ProofCheck]
    public let chainChecks: [ProofCheck]
    public let timestamp: Date
}

public struct ChainValidationResult {
    public let isValid: Bool
    public let blockNumber: Int
    public let transactionHash: String
    public let network: String
    public let confirmations: Int
    public let timestamp: Date
    public let checks: [ProofCheck]
}

