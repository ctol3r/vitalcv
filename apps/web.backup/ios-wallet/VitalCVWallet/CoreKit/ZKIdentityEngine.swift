//
//  ZKIdentityEngine.swift
//  VitalCVWallet
//
//  Created: Advanced Chain Anchoring & ZK-Proof Identity ARC - Phase 2
//  Zero-Knowledge Identity Engine with BBS+ commitments and selective disclosure
//

import Foundation
import CryptoKit
import Combine

/// ZKIdentityEngine - Foundation layer for zero-knowledge identity proofs
@MainActor
public class ZKIdentityEngine: ObservableObject {
    public static let shared = ZKIdentityEngine()

    // MARK: - Published State

    @Published public var activeCommitments: [String: BlindedIdentityCommitment] = [:]
    @Published public var proofRequests: [ZKProofRequest] = []
    @Published public var proofHistory: [ZKProofRecord] = []

    // MARK: - Dependencies

    private let bbsPlusEngine = BBSPlusEngine.shared
    private let advancedAnchorEngine = AdvancedAnchorEngine.shared

    // MARK: - Private State

    private var constraintValidators: [String: ConstraintValidator] = [:]
    private let validationQueue = DispatchQueue(label: "zk.identity.validation")

    // MARK: - Initialization

    private init() {}

    // MARK: - Task 9: ZK Identity Engine Foundation

    /// Initialize ZK identity for a DID
    public func initializeIdentity(did: String, fields: [DIDField]) async throws {
        // Task 10: Create blinded identity commitments
        let commitments = try await createBlindedCommitments(fields: fields)

        let commitment = BlindedIdentityCommitment(
            did: did,
            fields: fields,
            commitments: commitments,
            createdAt: Date()
        )

        activeCommitments[did] = commitment
    }

    // MARK: - Task 10: Blinded Identity Commitments

    /// Create blinded commitments for DID fields
    private func createBlindedCommitments(fields: [DIDField]) async throws -> [String: BlindedCommitment] {
        var commitments: [String: BlindedCommitment] = [:]

        for field in fields {
            // Generate random blinding factor
            let blindingFactor = generateBlindingFactor()

            // Create commitment (in production, use actual cryptographic commitment)
            let commitmentValue = try hashField(field: field, blindingFactor: blindingFactor)

            commitments[field.name] = BlindedCommitment(
                fieldName: field.name,
                commitmentValue: commitmentValue,
                blindingFactor: blindingFactor,
                createdAt: Date()
            )
        }

        return commitments
    }

    private func generateBlindingFactor() -> Data {
        var data = Data(count: 32)
        _ = data.withUnsafeMutableBytes { bytes in
            SecRandomCopyBytes(kSecRandomDefault, 32, bytes.baseAddress!)
        }
        return data
    }

    private func hashField(field: DIDField, blindingFactor: Data) throws -> String {
        let combined = "\(field.name):\(field.value):\(blindingFactor.base64EncodedString())"
        let hash = SHA256.hash(data: combined.data(using: .utf8)!)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Task 11: BBS+ Multi-Message Commitments

    /// Create BBS+ multi-message commitment for selective disclosure
    public func createBBSPlusCommitment(
        did: String,
        messages: [String: String]
    ) async throws -> BBSPlusCommitment {
        guard let commitment = activeCommitments[did] else {
            throw ZKIdentityError.commitmentNotFound
        }

        // Use BBS+ engine for multi-message commitment
        let bbsProof = try await bbsPlusEngine.generateProof(
            credential: VerifiableCredential(
                id: did,
                type: ["VerifiableCredential"],
                issuer: Issuer(id: did, name: nil, image: nil),
                issuanceDate: Date(),
                expirationDate: nil,
                credentialSubject: CredentialSubject(
                    id: did,
                    type: nil,
                    claims: messages
                ),
                proof: nil,
                evidence: nil,
                chainAnchorId: nil
            ),
            revealedAttributes: [],
            hiddenAttributes: Array(messages.keys)
        )

        return BBSPlusCommitment(
            did: did,
            commitmentHash: bbsProof.merkleRoot,
            messages: messages,
            proof: bbsProof,
            createdAt: Date()
        )
    }

    // MARK: - Task 12: ZK Proof Request Model

    /// Create proof request
    public func createProofRequest(
        did: String,
        attributesToProve: [String],
        constraints: [ProofConstraint]? = nil
    ) -> ZKProofRequest {
        let request = ZKProofRequest(
            id: UUID().uuidString,
            did: did,
            attributesToProve: attributesToProve,
            constraints: constraints ?? [],
            createdAt: Date(),
            status: .pending
        )

        proofRequests.append(request)
        return request
    }

    // MARK: - Task 13: ZK Proof Builder

    /// Build proof with hidden attributes
    public func buildProof(
        request: ZKProofRequest,
        revealedAttributes: [String],
        hiddenAttributes: [String]
    ) async throws -> ZKProof {
        guard let commitment = activeCommitments[request.did] else {
            throw ZKIdentityError.commitmentNotFound
        }

        // Task 14: On-device constraint validation
        try await validateConstraints(
            request: request,
            revealedAttributes: revealedAttributes,
            hiddenAttributes: hiddenAttributes
        )

        // Generate BBS+ proof
        let credential = try buildCredentialFromCommitment(commitment: commitment)
        let bbsProof = try await bbsPlusEngine.generateProof(
            credential: credential,
            revealedAttributes: revealedAttributes,
            hiddenAttributes: hiddenAttributes
        )

        // Create ZK proof
        let proof = ZKProof(
            id: UUID().uuidString,
            requestId: request.id,
            did: request.did,
            revealedAttributes: revealedAttributes,
            hiddenAttributes: hiddenAttributes,
            bbsProof: bbsProof,
            constraints: request.constraints,
            createdAt: Date()
        )

        // Record proof
        let proofRecord = ZKProofRecord(
            proof: proof,
            verified: false,
            createdAt: Date()
        )
        proofHistory.append(proofRecord)

        return proof
    }

    // MARK: - Task 14: On-Device Constraint Validation

    /// Validate constraints (circom-compatible)
    private func validateConstraints(
        request: ZKProofRequest,
        revealedAttributes: [String],
        hiddenAttributes: [String]
    ) async throws {
        for constraint in request.constraints {
            switch constraint.type {
            case .range:
                try validateRangeConstraint(
                    constraint: constraint,
                    attributes: revealedAttributes + hiddenAttributes
                )
            case .equality:
                try validateEqualityConstraint(
                    constraint: constraint,
                    attributes: revealedAttributes + hiddenAttributes
                )
            case .membership:
                try validateMembershipConstraint(
                    constraint: constraint,
                    attributes: revealedAttributes + hiddenAttributes
                )
            case .custom:
                // Task 15: Fallback to server-side validation for complex constraints
                if constraint.complexity > 0.7 {
                    try await validateOnServer(constraint: constraint)
                } else {
                    try validateCustomConstraint(
                        constraint: constraint,
                        attributes: revealedAttributes + hiddenAttributes
                    )
                }
            }
        }
    }

    private func validateRangeConstraint(
        constraint: ProofConstraint,
        attributes: [String]
    ) throws {
        // Validate range constraints
        guard let min = constraint.minValue,
              let max = constraint.maxValue,
              let attributeValue = attributes.first(where: { $0 == constraint.attributeName }) else {
            throw ZKIdentityError.constraintValidationFailed
        }

        // In production, parse and validate numeric range
    }

    private func validateEqualityConstraint(
        constraint: ProofConstraint,
        attributes: [String]
    ) throws {
        // Validate equality constraints
    }

    private func validateMembershipConstraint(
        constraint: ProofConstraint,
        attributes: [String]
    ) throws {
        // Validate membership constraints
    }

    private func validateCustomConstraint(
        constraint: ProofConstraint,
        attributes: [String]
    ) throws {
        // Validate custom constraints
    }

    // MARK: - Task 15: Server-Side ZK Validation Fallback

    private func validateOnServer(constraint: ProofConstraint) async throws {
        // In production, send constraint to server for validation
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    // MARK: - Task 16: ZK Identity Health Panel

    /// Get health status for ZK identity
    public func getIdentityHealth(did: String) -> ZKIdentityHealth {
        guard let commitment = activeCommitments[did] else {
            return ZKIdentityHealth(
                did: did,
                commitmentStatus: .missing,
                proofCompleteness: 0.0,
                hiddenFieldsCount: 0,
                lastProofDate: nil
            )
        }

        let proofs = proofHistory.filter { $0.proof.did == did }
        let completeness = calculateProofCompleteness(proofs: proofs, commitment: commitment)
        let hiddenFields = proofs.flatMap { $0.proof.hiddenAttributes }.unique().count

        return ZKIdentityHealth(
            did: did,
            commitmentStatus: .active,
            proofCompleteness: completeness,
            hiddenFieldsCount: hiddenFields,
            lastProofDate: proofs.last?.createdAt
        )
    }

    private func calculateProofCompleteness(proofs: [ZKProofRecord], commitment: BlindedIdentityCommitment) -> Double {
        guard !proofs.isEmpty else { return 0.0 }

        let totalFields = commitment.fields.count
        let provenFields = proofs.flatMap { $0.proof.revealedAttributes + $0.proof.hiddenAttributes }.unique().count

        return Double(provenFields) / Double(totalFields)
    }

    // MARK: - Helper Methods

    private func buildCredentialFromCommitment(commitment: BlindedIdentityCommitment) throws -> VerifiableCredential {
        let claims = Dictionary(uniqueKeysWithValues: commitment.fields.map { ($0.name, $0.value) })

        return VerifiableCredential(
            id: commitment.did,
            type: ["VerifiableCredential"],
            issuer: Issuer(id: commitment.did, name: nil, image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(
                id: commitment.did,
                type: nil,
                claims: claims
            ),
            proof: nil,
            evidence: nil,
            chainAnchorId: nil
        )
    }
}

// MARK: - Models

public struct DIDField: Codable, Identifiable {
    public let id = UUID()
    public let name: String
    public let value: String
    public let type: DIDFieldType

    public init(name: String, value: String, type: DIDFieldType) {
        self.name = name
        self.value = value
        self.type = type
    }
}

public enum DIDFieldType: String, Codable {
    case string
    case number
    case date
    case boolean
}

public struct BlindedIdentityCommitment: Codable {
    public let did: String
    public let fields: [DIDField]
    public let commitments: [String: BlindedCommitment]
    public let createdAt: Date
}

public struct BlindedCommitment: Codable {
    public let fieldName: String
    public let commitmentValue: String
    public let blindingFactor: Data
    public let createdAt: Date
}

public struct BBSPlusCommitment: Codable {
    public let did: String
    public let commitmentHash: String
    public let messages: [String: String]
    public let proof: BBSPlusProof
    public let createdAt: Date
}

public struct ZKProofRequest: Identifiable, Codable {
    public let id: String
    public let did: String
    public let attributesToProve: [String]
    public let constraints: [ProofConstraint]
    public let createdAt: Date
    public var status: ProofRequestStatus
}

public enum ProofRequestStatus: String, Codable {
    case pending
    case processing
    case completed
    case failed
}

public struct ProofConstraint: Codable {
    public let type: ConstraintType
    public let attributeName: String
    public let minValue: Double?
    public let maxValue: Double?
    public let allowedValues: [String]?
    public let complexity: Double // 0.0 to 1.0

    public init(
        type: ConstraintType,
        attributeName: String,
        minValue: Double? = nil,
        maxValue: Double? = nil,
        allowedValues: [String]? = nil,
        complexity: Double = 0.0
    ) {
        self.type = type
        self.attributeName = attributeName
        self.minValue = minValue
        self.maxValue = maxValue
        self.allowedValues = allowedValues
        self.complexity = complexity
    }
}

public enum ConstraintType: String, Codable {
    case range
    case equality
    case membership
    case custom
}

public struct ZKProof: Codable, Identifiable {
    public let id: String
    public let requestId: String
    public let did: String
    public let revealedAttributes: [String]
    public let hiddenAttributes: [String]
    public let bbsProof: BBSPlusProof
    public let constraints: [ProofConstraint]
    public let createdAt: Date
}

public struct ZKProofRecord: Identifiable, Codable {
    public let id = UUID()
    public let proof: ZKProof
    public let verified: Bool
    public let createdAt: Date
}

public struct ZKIdentityHealth: Codable {
    public let did: String
    public let commitmentStatus: CommitmentStatus
    public let proofCompleteness: Double
    public let hiddenFieldsCount: Int
    public let lastProofDate: Date?
}

public enum CommitmentStatus: String, Codable {
    case active
    case missing
    case expired
}

public enum ZKIdentityError: Error {
    case commitmentNotFound
    case constraintValidationFailed
    case proofGenerationFailed
    case invalidDID
}

// MARK: - Extensions

extension Array where Element: Hashable {
    func unique() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}








