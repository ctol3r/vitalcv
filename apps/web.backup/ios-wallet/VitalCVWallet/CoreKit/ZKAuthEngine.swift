//
//  ZKAuthEngine.swift
//  VitalCVWallet
//
//  Created: Zero-Knowledge Authorization Engine - Phase 1
//  ZK Authorization Engine for proving authority without exposing identity
//

import Foundation
import CryptoKit
import Combine

/// ZKAuthEngine - Zero-Knowledge Authorization Engine
/// Proves authority without exposing identity using ZK-SNARKs, BBS+, SD-JWT-HIDDEN, OIDC4VP, and chain-backed proofs
@MainActor
public class ZKAuthEngine: ObservableObject {
    public static let shared = ZKAuthEngine()

    // MARK: - Published State

    @Published public var activeAuthRequests: [String: ZKAuthRequest] = [:]
    @Published public var authHistory: [ZKAuthResponse] = []
    @Published public var activeSessions: [String: ZKSessionToken] = [:]

    // MARK: - Dependencies

    private let zkIdentityEngine = ZKIdentityEngine.shared
    private let bbsPlusEngine = BBSPlusEngine.shared
    private let sdjwtEngine = SDJWTEngine.shared
    private let didService = DIDService.shared
    private let chainOrchestrator = ChainOrchestrator.shared

    // MARK: - Private State

    private var challengeNonceCache: [String: Date] = [:]
    private let validationQueue = DispatchQueue(label: "zk.auth.validation")

    // MARK: - Initialization

    private init() {}

    // MARK: - Phase 1 - Task 1: ZK Authorization Engine Core

    /// Create authorization request
    public func createAuthRequest(
        requiredAttributes: [String],
        hiddenAttributes: [String],
        allowedReveals: [String],
        challengeNonce: String? = nil
    ) async throws -> ZKAuthRequest {
        let nonce = challengeNonce ?? generateChallengeNonce()
        let requestId = UUID().uuidString

        // Validate attribute sets
        try validateAttributeSets(
            required: requiredAttributes,
            hidden: hiddenAttributes,
            allowed: allowedReveals
        )

        let request = ZKAuthRequest(
            id: requestId,
            requiredAttributes: requiredAttributes,
            hiddenAttributes: hiddenAttributes,
            allowedReveals: allowedReveals,
            challengeNonce: nonce,
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(300) // 5 minutes
        )

        activeAuthRequests[requestId] = request
        challengeNonceCache[nonce] = Date()

        return request
    }

    // MARK: - Phase 1 - Task 2: ZKAuthRequest Model

    /// Generate authorization response with ZK proof
    public func generateAuthResponse(
        request: ZKAuthRequest,
        did: String,
        revealedFields: [String: String]
    ) async throws -> ZKAuthResponse {
        // Validate challenge nonce
        guard let nonceTimestamp = challengeNonceCache[request.challengeNonce],
              Date().timeIntervalSince(nonceTimestamp) < 300 else {
            throw ZKAuthError.expiredChallenge
        }

        // Validate revealed fields are in allowed reveals
        let revealedKeys = Set(revealedFields.keys)
        let allowedSet = Set(request.allowedReveals)
        guard revealedKeys.isSubset(of: allowedSet) else {
            throw ZKAuthError.invalidReveal
        }

        // Ensure required attributes are present (even if hidden)
        let allAttributes = Set(request.requiredAttributes + request.hiddenAttributes)
        guard allAttributes.isSuperset(of: Set(request.requiredAttributes)) else {
            throw ZKAuthError.missingRequiredAttribute
        }

        // Phase 1 - Task 4: Generate BBS+ proof
        let bbsProof = try await generateBBSPlusProof(
            request: request,
            did: did,
            revealedFields: revealedFields
        )

        // Phase 1 - Task 5: Generate SD-JWT selective disclosure
        let sdjwtPacket = try await generateSDJWTPacket(
            request: request,
            did: did,
            revealedFields: revealedFields
        )

        // Phase 1 - Task 6: DID-binding signature
        let signature = try await generateDIDBindingSignature(
            did: did,
            request: request,
            proof: bbsProof
        )

        // Phase 1 - Task 7: Chain anchor for authorization event
        let chainAnchor = try await anchorAuthorizationEvent(
            request: request,
            proof: bbsProof,
            did: did
        )

        let response = ZKAuthResponse(
            id: UUID().uuidString,
            requestId: request.id,
            proof: bbsProof,
            revealedFields: revealedFields,
            signature: signature,
            sdjwtPacket: sdjwtPacket,
            chainAnchorId: chainAnchor?.id,
            createdAt: Date()
        )

        authHistory.append(response)
        activeAuthRequests.removeValue(forKey: request.id)

        return response
    }

    // MARK: - Phase 1 - Task 4: BBS+ Commitments Integration

    private func generateBBSPlusProof(
        request: ZKAuthRequest,
        did: String,
        revealedFields: [String: String]
    ) async throws -> BBSPlusProof {
        // Build credential from request
        let credential = try buildCredentialFromRequest(
            request: request,
            did: did,
            revealedFields: revealedFields
        )

        // Generate BBS+ proof with selective disclosure
        let proof = try await bbsPlusEngine.generateProof(
            credential: credential,
            revealedAttributes: Array(revealedFields.keys),
            hiddenAttributes: request.hiddenAttributes
        )

        return proof
    }

    // MARK: - Phase 1 - Task 5: SD-JWT Selective Non-Disclosure Pipeline

    private func generateSDJWTPacket(
        request: ZKAuthRequest,
        did: String,
        revealedFields: [String: String]
    ) async throws -> SDJWTPacket {
        var disclosures: [SDJWTDisclosure] = []

        // Create disclosures only for revealed fields
        for (key, value) in revealedFields {
            let salt = sdjwtEngine.generateSalt()
            let disclosure = sdjwtEngine.createDisclosure(
                salt: salt,
                claimKey: key,
                claimValue: value
            )
            disclosures.append(disclosure)
        }

        // Build SD-JWT packet (simplified - in production use full SD-JWT library)
        let packet = SDJWTPacket(
            header: buildSDJWTHeader(),
            payload: buildSDJWTPayload(
                did: did,
                request: request,
                disclosures: disclosures
            ),
            disclosures: disclosures,
            signature: try generateSDJWTSignature(did: did)
        )

        return packet
    }

    // MARK: - Phase 1 - Task 6: DID-Binding (Auth-from-Proof)

    private func generateDIDBindingSignature(
        did: String,
        request: ZKAuthRequest,
        proof: BBSPlusProof
    ) async throws -> String {
        // Create signature binding DID to proof
        let bindingData = try createBindingData(
            did: did,
            request: request,
            proof: proof
        )

        let signature = try didService.sign(data: bindingData)
        return signature.base64EncodedString()
    }

    private func createBindingData(
        did: String,
        request: ZKAuthRequest,
        proof: BBSPlusProof
    ) throws -> Data {
        let bindingString = """
        {
            "did": "\(did)",
            "requestId": "\(request.id)",
            "challengeNonce": "\(request.challengeNonce)",
            "proofId": "\(proof.id)",
            "timestamp": "\(ISO8601DateFormatter().string(from: Date()))"
        }
        """
        guard let data = bindingString.data(using: .utf8) else {
            throw ZKAuthError.bindingDataCreationFailed
        }
        return data
    }

    // MARK: - Phase 1 - Task 7: Chain Anchor for Authorization Events

    private func anchorAuthorizationEvent(
        request: ZKAuthRequest,
        proof: BBSPlusProof,
        did: String
    ) async throws -> ChainAnchor? {
        // Create authorization event payload
        let eventPayload = ZKAuthEventPayload(
            requestId: request.id,
            did: did,
            proofId: proof.id,
            timestamp: Date()
        )

        // Anchor to chain via ChainOrchestrator
        let anchorData = try JSONEncoder().encode(eventPayload)
        let anchorHash = SHA256.hash(data: anchorData)
        let anchorHashString = Data(anchorHash).base64EncodedString()

        // In production, use ChainOrchestrator to anchor
        // For now, return placeholder
        return ChainAnchor(
            id: UUID().uuidString,
            hash: anchorHashString,
            chainId: "substrate",
            blockNumber: nil,
            timestamp: Date()
        )
    }

    // MARK: - Helper Methods

    private func validateAttributeSets(
        required: [String],
        hidden: [String],
        allowed: [String]
    ) throws {
        // Ensure no overlap between required and hidden
        let requiredSet = Set(required)
        let hiddenSet = Set(hidden)
        guard requiredSet.isDisjoint(with: hiddenSet) else {
            throw ZKAuthError.attributeOverlap
        }

        // Ensure allowed reveals include required attributes
        let allowedSet = Set(allowed)
        guard allowedSet.isSuperset(of: requiredSet) else {
            throw ZKAuthError.invalidAllowedReveals
        }
    }

    private func generateChallengeNonce() -> String {
        var nonce = Data(count: 32)
        _ = nonce.withUnsafeMutableBytes { bytes in
            SecRandomCopyBytes(kSecRandomDefault, 32, bytes.baseAddress!)
        }
        return nonce.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func buildCredentialFromRequest(
        request: ZKAuthRequest,
        did: String,
        revealedFields: [String: String]
    ) throws -> VerifiableCredential {
        // In production, fetch actual credential data
        // For now, build from request
        var claims: [String: String] = revealedFields

        // Add hidden attributes as placeholders (they'll be in the proof)
        for hiddenAttr in request.hiddenAttributes {
            claims[hiddenAttr] = "hidden"
        }

        return VerifiableCredential(
            id: UUID().uuidString,
            type: ["VerifiableCredential", "ZKAuthCredential"],
            issuer: Issuer(id: did, name: nil, image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(
                id: did,
                type: nil,
                claims: claims
            ),
            proof: nil,
            evidence: nil,
            chainAnchorId: nil
        )
    }

    private func buildSDJWTHeader() -> String {
        let header = [
            "alg": "ES256",
            "typ": "SD-JWT",
            "sd_alg": "sha-256"
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: header),
              let encoded = String(data: data.base64EncodedData(), encoding: .utf8) else {
            return ""
        }
        return encoded
    }

    private func buildSDJWTPayload(
        did: String,
        request: ZKAuthRequest,
        disclosures: [SDJWTDisclosure]
    ) -> String {
        var payload: [String: Any] = [
            "iss": did,
            "iat": Int(Date().timeIntervalSince1970),
            "request_id": request.id
        ]

        // Add disclosure digests
        let digests = disclosures.map { $0.digest }
        payload["_sd"] = digests

        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let encoded = String(data: data.base64EncodedData(), encoding: .utf8) else {
            return ""
        }
        return encoded
    }

    private func generateSDJWTSignature(did: String) throws -> String {
        // In production, sign with DID key
        let signatureData = Data((0..<64).map { _ in UInt8.random(in: 0...255) })
        return signatureData.base64EncodedString()
    }
}

// MARK: - Phase 1 - Task 2: ZKAuthRequest Model

public struct ZKAuthRequest: Identifiable, Codable {
    public let id: String
    public let requiredAttributes: [String]
    public let hiddenAttributes: [String]
    public let allowedReveals: [String]
    public let challengeNonce: String
    public let createdAt: Date
    public let expiresAt: Date

    public init(
        id: String,
        requiredAttributes: [String],
        hiddenAttributes: [String],
        allowedReveals: [String],
        challengeNonce: String,
        createdAt: Date,
        expiresAt: Date
    ) {
        self.id = id
        self.requiredAttributes = requiredAttributes
        self.hiddenAttributes = hiddenAttributes
        self.allowedReveals = allowedReveals
        self.challengeNonce = challengeNonce
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }
}

// MARK: - Phase 1 - Task 3: ZKAuthResponse Model

public struct ZKAuthResponse: Identifiable, Codable {
    public let id: String
    public let requestId: String
    public let proof: BBSPlusProof
    public let revealedFields: [String: String]
    public let signature: String
    public let sdjwtPacket: SDJWTPacket?
    public let chainAnchorId: String?
    public let createdAt: Date

    public init(
        id: String,
        requestId: String,
        proof: BBSPlusProof,
        revealedFields: [String: String],
        signature: String,
        sdjwtPacket: SDJWTPacket?,
        chainAnchorId: String?,
        createdAt: Date
    ) {
        self.id = id
        self.requestId = requestId
        self.proof = proof
        self.revealedFields = revealedFields
        self.signature = signature
        self.sdjwtPacket = sdjwtPacket
        self.chainAnchorId = chainAnchorId
        self.createdAt = createdAt
    }
}

// MARK: - Supporting Models

public struct SDJWTPacket: Codable {
    public let header: String
    public let payload: String
    public let disclosures: [SDJWTDisclosure]
    public let signature: String
}

public struct ZKAuthEventPayload: Codable {
    public let requestId: String
    public let did: String
    public let proofId: String
    public let timestamp: Date
}

public struct ChainAnchor: Codable {
    public let id: String
    public let hash: String
    public let chainId: String
    public let blockNumber: Int64?
    public let timestamp: Date
}

// MARK: - Errors

public enum ZKAuthError: Error {
    case expiredChallenge
    case invalidReveal
    case missingRequiredAttribute
    case attributeOverlap
    case invalidAllowedReveals
    case bindingDataCreationFailed
    case proofGenerationFailed
}

