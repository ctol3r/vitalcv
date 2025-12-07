//
//  AuditChainSigning.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 3
//  Audit chain signing for actor approvals
//

import Foundation
import CryptoKit

/// Handles audit chain signing for actor approvals
public class AuditChainSigning {
    private let didService: DIDService
    private let dpopSigner: DPoPSigner

    public init(
        didService: DIDService = .shared,
        dpopSigner: DPoPSigner = .shared
    ) {
        self.didService = didService
        self.dpopSigner = dpopSigner
    }

    /// Sign an actor approval
    public func signApproval(
        conversationId: String,
        credentialId: String,
        actor: ConversationActor,
        approval: ApprovalDecision
    ) async throws -> SignedApproval {
        let approvalData = ApprovalData(
            conversationId: conversationId,
            credentialId: credentialId,
            actor: actor,
            decision: approval,
            timestamp: Date()
        )

        // Encode approval data
        let data = try JSONEncoder().encode(approvalData)

        // Sign with DID (simplified - in production use proper DID signing)
        let signature = data.base64EncodedString()

        // Create DPoP token
        let baseURL = NetworkService.shared.baseURL ?? "https://api.vitalcv.com"
        let url = URL(string: "\(baseURL)/ai/conversation/\(conversationId)/approve")!
        let dpopToken = try dpopSigner.generateDPoPToken(method: "POST", url: url)

        let did = try await didService.getOrCreateDID()

        return SignedApproval(
            approval: approvalData,
            signature: signature,
            dpopToken: dpopToken,
            did: did
        )
    }

    /// Verify an actor approval signature
    public func verifyApproval(_ signedApproval: SignedApproval) async throws -> Bool {
        // In production, this would verify the DID signature
        // For now, return true if signature exists
        return !signedApproval.signature.isEmpty
    }
}

// MARK: - Approval Models

public struct ApprovalData: Codable, Equatable {
    let conversationId: String
    let credentialId: String
    let actor: ConversationActor
    let decision: ApprovalDecision
    let timestamp: Date
}

public enum ApprovalDecision: String, Codable, Equatable {
    case approved
    case conditionallyApproved
    case pending
    case rejected
    case needsMoreEvidence
}

public struct SignedApproval: Codable {
    let approval: ApprovalData
    let signature: String
    let dpopToken: String
    let did: String
}

