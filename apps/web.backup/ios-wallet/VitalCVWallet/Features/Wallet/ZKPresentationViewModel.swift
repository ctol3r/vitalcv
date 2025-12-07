//
//  ZKPresentationViewModel.swift
//  VitalCVWallet
//
//  Created: Advanced Chain Anchoring & ZK-Proof Identity ARC - Phase 3
//  ZK Presentation ViewModel for credential presentation with selective disclosure
//

import Foundation
import SwiftUI
import Combine

/// ZKPresentationViewModel - ViewModel for ZK credential presentation
@MainActor
public class ZKPresentationViewModel: ObservableObject {
    // MARK: - Published State

    @Published public var credential: VerifiableCredential
    @Published public var disclosureMode: DisclosureMode = .minimum
    @Published public var revealedAttributes: [String] = []
    @Published public var hiddenAttributes: [String] = []
    @Published public var proof: ZKProof?
    @Published public var proofStrength: Double = 0.0
    @Published public var trustScore: Double = 0.0
    @Published public var isGeneratingProof: Bool = false
    @Published public var proofError: String?
    @Published public var chainAnchor: MultiLedgerAnchor?
    @Published public var zkReceipt: ZKAnchorReceipt?

    // MARK: - Dependencies

    private let zkIdentityEngine = ZKIdentityEngine.shared
    private let advancedAnchorEngine = AdvancedAnchorEngine.shared
    private let trustKit = VitalCVTrustKit.shared

    // MARK: - Initialization

    public init(credential: VerifiableCredential) {
        self.credential = credential
        initializeAttributes()
    }

    // MARK: - Task 17: ZK Presentation ViewModel

    /// Initialize attributes based on credential
    private func initializeAttributes() {
        let allAttributes = Array(credential.credentialSubject.claims.keys)

        switch disclosureMode {
        case .zero:
            // Task 18: Reveal 0 attributes mode
            revealedAttributes = []
            hiddenAttributes = allAttributes
        case .minimum:
            // Reveal minimum required attributes
            revealedAttributes = ["id"] // Always reveal ID
            hiddenAttributes = allAttributes.filter { $0 != "id" }
        case .partial:
            // Task 19: Partial ZK reveal
            revealedAttributes = ["id", "name"] // Example
            hiddenAttributes = allAttributes.filter { !revealedAttributes.contains($0) }
        case .full:
            revealedAttributes = allAttributes
            hiddenAttributes = []
        }
    }

    // MARK: - Task 18: Reveal 0 Attributes Mode

    /// Switch to zero-disclosure mode
    public func switchToZeroDisclosure() {
        disclosureMode = .zero
        revealedAttributes = []
        hiddenAttributes = Array(credential.credentialSubject.claims.keys)
        updateProofStrength()
    }

    // MARK: - Task 19: Partial ZK Reveal

    /// Toggle attribute disclosure
    public func toggleAttribute(_ attribute: String) {
        if revealedAttributes.contains(attribute) {
            revealedAttributes.removeAll { $0 == attribute }
            hiddenAttributes.append(attribute)
        } else {
            hiddenAttributes.removeAll { $0 == attribute }
            revealedAttributes.append(attribute)
        }

        disclosureMode = .partial
        updateProofStrength()
    }

    // MARK: - Task 20: UI State for Hidden/Revealed Fields

    /// Get attribute display state
    public func getAttributeState(_ attribute: String) -> AttributeDisplayState {
        if revealedAttributes.contains(attribute) {
            return .revealed
        } else if hiddenAttributes.contains(attribute) {
            return .hidden
        } else {
            return .unknown
        }
    }

    // MARK: - Task 21: Proof Strength Meter

    /// Update proof strength based on ZK complexity and trust score
    public func updateProofStrength() {
        let zkComplexity = calculateZKComplexity()
        let anchorTrust = calculateAnchorTrust()

        // Combine ZK complexity and anchor trust
        proofStrength = (zkComplexity * 0.6) + (anchorTrust * 0.4)

        // Update trust score
        trustScore = proofStrength
    }

    private func calculateZKComplexity() -> Double {
        let totalAttributes = credential.credentialSubject.claims.count
        guard totalAttributes > 0 else { return 0.0 }

        let hiddenCount = hiddenAttributes.count
        let hiddenRatio = Double(hiddenCount) / Double(totalAttributes)

        // Higher complexity = more hidden attributes
        return hiddenRatio
    }

    private func calculateAnchorTrust() -> Double {
        guard let anchor = chainAnchor else { return 0.0 }
        return advancedAnchorEngine.calculateAgingTrustScore(anchor: anchor)
    }

    // MARK: - Generate Proof

    /// Generate ZK proof for presentation
    public func generateProof() async {
        isGeneratingProof = true
        proofError = nil

        do {
            // Create proof request
            let request = zkIdentityEngine.createProofRequest(
                did: credential.credentialSubject.id,
                attributesToProve: revealedAttributes + hiddenAttributes
            )

            // Build proof
            let generatedProof = try await zkIdentityEngine.buildProof(
                request: request,
                revealedAttributes: revealedAttributes,
                hiddenAttributes: hiddenAttributes
            )

            self.proof = generatedProof

            // Task 23: Chain-anchored ZK receipt
            await createChainAnchoredReceipt(proof: generatedProof)

            // Update proof strength
            updateProofStrength()

        } catch {
            proofError = error.localizedDescription
        }

        isGeneratingProof = false
    }

    // MARK: - Task 23: Chain-Anchored ZK Receipt

    private func createChainAnchoredReceipt(proof: ZKProof) async {
        // Get or create chain anchor
        if chainAnchor == nil, let anchorId = credential.chainAnchorId {
            // Try to fetch existing anchor
            // In production, fetch from storage
        }

        // Create ZK receipt with anchor hash
        let receipt = ZKAnchorReceipt(
            proofId: proof.id,
            credentialId: credential.id,
            anchorHash: chainAnchor?.vector.hash,
            zkMetadata: ZKReceiptMetadata(
                revealedCount: revealedAttributes.count,
                hiddenCount: hiddenAttributes.count,
                proofStrength: proofStrength,
                trustScore: trustScore,
                createdAt: Date()
            )
        )

        zkReceipt = receipt
    }

    // MARK: - Task 24: DPoP-Bound ZK Presentation Tokens

    /// Create DPoP-bound presentation token
    public func createDPoPToken() async throws -> DPoPZKToken {
        guard let proof = proof else {
            throw ZKPresentationError.proofNotGenerated
        }

        // In production, use DPoP signer
        let token = DPoPZKToken(
            proofId: proof.id,
            credentialId: credential.id,
            nonce: UUID().uuidString,
            timestamp: Date(),
            signature: "dpop_signature_placeholder"
        )

        return token
    }
}

// MARK: - Models

public enum DisclosureMode: String, Codable {
    case zero = "zero"
    case minimum = "minimum"
    case partial = "partial"
    case full = "full"
}

public enum AttributeDisplayState {
    case revealed
    case hidden
    case unknown
}

public struct ZKAnchorReceipt: Codable {
    public let proofId: String
    public let credentialId: String
    public let anchorHash: String?
    public let zkMetadata: ZKReceiptMetadata
}

public struct ZKReceiptMetadata: Codable {
    public let revealedCount: Int
    public let hiddenCount: Int
    public let proofStrength: Double
    public let trustScore: Double
    public let createdAt: Date
}

public struct DPoPZKToken: Codable {
    public let proofId: String
    public let credentialId: String
    public let nonce: String
    public let timestamp: Date
    public let signature: String
}

public enum ZKPresentationError: Error {
    case proofNotGenerated
    case invalidCredential
    case anchorNotFound
}








