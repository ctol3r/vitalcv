//
//  ConversationEngine+MegaPrompt.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 4
//  "Ask all parties" mega-prompt feature
//

import Foundation

extension ConversationEngine {

    /// Ask all parties: "What's blocking my credential?"
    public func askAllParties(
        credentialId: String,
        context: ConversationContext
    ) async throws -> [ConversationMessage] {
        let allActors: [ConversationActor] = [
            .hospital,
            .stateBoard,
            .dea,
            .cmsPecos,
            .payer,
            .trainingProgram,
            .privilegingOffice,
            .skillSupervisor,
            .aiAuditor
        ]

        // Create or get conversation
        let conversationId = UUID().uuidString
        let conversation = try await startConversation(
            context: context,
            actors: allActors,
            initialMessage: "What's blocking my credential \(credentialId)? Please identify any issues or missing requirements."
        )

        // Route to all actors
        return try await routeMessage(
            conversationId: conversation.id,
            message: "What's blocking credential \(credentialId)? Please identify any issues or missing requirements.",
            targetActors: allActors
        )
    }

    /// Get consensus summary from all parties
    public func getConsensus(
        conversationId: String,
        credentialId: String
    ) async throws -> ConsensusSummary {
        // Get all messages from conversation
        let messages = messageHistory[conversationId] ?? []

        // Analyze messages to determine consensus
        let verifiedCount = messages.filter { $0.verified == true }.count
        let totalCount = messages.count
        let hasConflicts = messages.contains { $0.messageType == .conflict }

        let status: ConsensusStatus
        if verifiedCount == totalCount && !hasConflicts {
            status = .verified
        } else if hasConflicts {
            status = .conditional
        } else {
            status = .pending
        }

        return ConsensusSummary(
            credentialId: credentialId,
            status: status,
            verifiedCount: verifiedCount,
            totalCount: totalCount,
            blockingIssues: messages
                .filter { $0.messageType == .conflict || $0.messageType == .escalation }
                .map { $0.content },
            consensusMessage: generateConsensusMessage(status: status, messages: messages)
        )
    }

    private func generateConsensusMessage(
        status: ConsensusStatus,
        messages: [ConversationMessage]
    ) -> String {
        switch status {
        case .verified:
            return "✅ Consensus: Credential Verified - All parties have verified the credential."
        case .pending:
            return "⏳ Consensus: Pending - Waiting for verification from all parties."
        case .conditional:
            return "⚠️ Consensus: Conditional - Some issues need to be resolved before approval."
        }
    }
}

// MARK: - Consensus Models

public struct ConsensusSummary: Codable, Equatable {
    let credentialId: String
    let status: ConsensusStatus
    let verifiedCount: Int
    let totalCount: Int
    let blockingIssues: [String]
    let consensusMessage: String
}

public enum ConsensusStatus: String, Codable, Equatable {
    case verified
    case pending
    case conditional
}

