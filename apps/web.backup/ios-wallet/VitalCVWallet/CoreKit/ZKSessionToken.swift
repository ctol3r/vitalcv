//
//  ZKSessionToken.swift
//  VitalCVWallet
//
//  Created: Zero-Knowledge Authorization Engine - Phase 3
//  ZK Session Tokens - Replace identity-based sessions with ZK-proof-based sessions
//

import Foundation
import CryptoKit
import Combine

/// ZKSessionTokenCreator - Creates ephemeral ZK tokens bound to DID public key
@MainActor
public class ZKSessionTokenCreator {
    public static let shared = ZKSessionTokenCreator()

    private let zkAuthEngine = ZKAuthEngine.shared
    private let didService = DIDService.shared
    private let chainOrchestrator = ChainOrchestrator.shared

    private init() {}

    // MARK: - Phase 3 - Task 17: ZKSessionTokenCreator

    /// Create ephemeral ZK token bound to DID public key (no PII stored)
    public func createSessionToken(
        did: String,
        scope: [String],
        duration: TimeInterval = 3600 // 1 hour default
    ) async throws -> ZKSessionToken {
        // Create minimal auth request for session
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["sessionId", "did"],
            hiddenAttributes: ["name", "email", "phone", "address"],
            allowedReveals: ["sessionId", "did", "scope"]
        )

        // Generate minimal proof (just enough to bind DID)
        let revealedFields: [String: String] = [
            "sessionId": UUID().uuidString,
            "did": did,
            "scope": scope.joined(separator: ",")
        ]

        let authResponse = try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )

        // Phase 3 - Task 18: Chain-attested session receipt
        let receipt = try await createChainAttestedReceipt(
            authResponse: authResponse,
            did: did
        )

        // Create session token
        let token = ZKSessionToken(
            id: UUID().uuidString,
            did: did,
            proofId: authResponse.proof.id,
            signature: authResponse.signature,
            scope: scope,
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(duration),
            chainReceiptId: receipt.id,
            nonce: generateSessionNonce()
        )

        return token
    }

    // MARK: - Phase 3 - Task 18: Chain-Attested Session Receipts

    private func createChainAttestedReceipt(
        authResponse: ZKAuthResponse,
        did: String
    ) async throws -> ChainAttestedReceipt {
        // Create receipt payload
        let receiptPayload = SessionReceiptPayload(
            sessionId: UUID().uuidString,
            did: did,
            proofId: authResponse.proof.id,
            timestamp: Date()
        )

        // Anchor to chain
        let anchorData = try JSONEncoder().encode(receiptPayload)
        let anchorHash = SHA256.hash(data: anchorData)
        let anchorHashString = Data(anchorHash).base64EncodedString()

        // In production, use ChainOrchestrator to anchor
        return ChainAttestedReceipt(
            id: UUID().uuidString,
            sessionId: receiptPayload.sessionId,
            chainHash: anchorHashString,
            blockNumber: nil,
            timestamp: Date()
        )
    }

    private func generateSessionNonce() -> String {
        var nonce = Data(count: 32)
        _ = nonce.withUnsafeMutableBytes { bytes in
            SecRandomCopyBytes(kSecRandomDefault, 32, bytes.baseAddress!)
        }
        return nonce.base64EncodedString()
    }
}

/// ZKSessionValidator - Server-side session validation
@MainActor
public class ZKSessionValidator {
    public static let shared = ZKSessionValidator()

    private let zkAuthEngine = ZKAuthEngine.shared
    private var validatedSessions: [String: ZKSessionValidationResult] = [:]

    private init() {}

    // MARK: - Phase 3 - Task 19: ZKSessionValidator

    /// Validate ZK session token
    public func validateSession(
        token: ZKSessionToken
    ) async throws -> ZKSessionValidationResult {
        // Phase 3 - Task 20: Multi-factor ZK challenge
        let timeBasedValid = validateTimeBasedChallenge(token: token)
        let anchorBasedValid = try await validateAnchorBasedChallenge(token: token)

        // Phase 3 - Task 21: Proof freshness validator
        let freshnessValid = validateProofFreshness(token: token)

        // Phase 3 - Task 25: Proof freshness validator (duplicate check)
        let isFresh = Date().timeIntervalSince(token.createdAt) < 3600 // 1 hour

        // Phase 3 - Task 27: ZK multi-chain alignment check
        let chainAlignmentValid = try await validateMultiChainAlignment(token: token)

        // Combine validations
        let isValid = timeBasedValid && anchorBasedValid && freshnessValid && isFresh && chainAlignmentValid

        let result = ZKSessionValidationResult(
            tokenId: token.id,
            valid: isValid,
            timeBasedValid: timeBasedValid,
            anchorBasedValid: anchorBasedValid,
            freshnessValid: freshnessValid && isFresh,
            chainAlignmentValid: chainAlignmentValid,
            validatedAt: Date()
        )

        validatedSessions[token.id] = result
        return result
    }

    // MARK: - Phase 3 - Task 20: Multi-Factor ZK Challenge

    private func validateTimeBasedChallenge(token: ZKSessionToken) -> Bool {
        // Check token hasn't expired
        return Date() < token.expiresAt
    }

    private func validateAnchorBasedChallenge(token: ZKSessionToken) async throws -> Bool {
        // Verify chain receipt exists and is valid
        guard let receiptId = token.chainReceiptId else {
            return false
        }

        // In production, verify receipt on chain
        // For now, return true if receipt ID exists
        return !receiptId.isEmpty
    }

    // MARK: - Phase 3 - Task 21: Proof Freshness Validator

    private func validateProofFreshness(token: ZKSessionToken) -> Bool {
        // Check token was created recently (within freshness window)
        let age = Date().timeIntervalSince(token.createdAt)
        return age < 3600 // 1 hour freshness window
    }

    // MARK: - Phase 3 - Task 22: Fallback to DPoP

    /// Fallback to DPoP if ZK unavailable
    public func fallbackToDPoP(
        token: ZKSessionToken
    ) async throws -> DPoPToken? {
        // If ZK validation fails, try DPoP
        let validation = try await validateSession(token: token)

        if !validation.valid {
            // Generate DPoP token as fallback
            return try await generateDPoPToken(did: token.did)
        }

        return nil
    }

    private func generateDPoPToken(did: String) async throws -> DPoPToken {
        // In production, generate actual DPoP token
        return DPoPToken(
            id: UUID().uuidString,
            did: did,
            jti: UUID().uuidString,
            iat: Date(),
            exp: Date().addingTimeInterval(3600),
            htm: "POST",
            htu: "https://api.vitalcv.com",
            ath: ""
        )
    }

    // MARK: - Phase 3 - Task 23: ZK Multi-Chain Alignment Check

    private func validateMultiChainAlignment(token: ZKSessionToken) async throws -> Bool {
        // Verify token is aligned across multiple chains
        guard let receiptId = token.chainReceiptId else {
            return false
        }

        // In production, check alignment across chains
        // For now, return true if receipt exists
        return !receiptId.isEmpty
    }
}

// MARK: - Models

public struct ZKSessionToken: Identifiable, Codable {
    public let id: String
    public let did: String
    public let proofId: String
    public let signature: String
    public let scope: [String]
    public let createdAt: Date
    public let expiresAt: Date
    public let chainReceiptId: String?
    public let nonce: String
}

public struct ChainAttestedReceipt: Codable {
    public let id: String
    public let sessionId: String
    public let chainHash: String
    public let blockNumber: Int64?
    public let timestamp: Date
}

public struct SessionReceiptPayload: Codable {
    public let sessionId: String
    public let did: String
    public let proofId: String
    public let timestamp: Date
}

public struct ZKSessionValidationResult: Codable {
    public let tokenId: String
    public let valid: Bool
    public let timeBasedValid: Bool
    public let anchorBasedValid: Bool
    public let freshnessValid: Bool
    public let chainAlignmentValid: Bool
    public let validatedAt: Date
}

public struct DPoPToken: Codable {
    public let id: String
    public let did: String
    public let jti: String
    public let iat: Date
    public let exp: Date
    public let htm: String
    public let htu: String
    public let ath: String
}

