//
//  BoardCertDialogue.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 2
//  Board certification specialty + revalidation dialogue
//

import Foundation

/// Dialogue module for board certification conversations
public class BoardCertDialogue {
    private let conversationEngine: ConversationEngine

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Verify board certification
    public func verifyBoardCertification(
        certificationId: String,
        specialty: String,
        boardName: String,
        clinicianId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [certificationId],
            chainData: nil,
            compliance: ComplianceData(
                status: "active",
                issues: [],
                lastAudit: nil
            ),
            skills: nil,
            scopeRules: nil,
            facilityNeeds: nil,
            clinicianId: clinicianId
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .hospital],
            initialMessage: "I need to verify my \(specialty) board certification from \(boardName) (Cert #: \(certificationId))"
        )
    }

    /// Check revalidation requirements
    public func checkRevalidationRequirements(
        certificationId: String,
        specialty: String,
        expirationDate: Date?
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [certificationId],
            chainData: nil,
            compliance: ComplianceData(
                status: expirationDate != nil && expirationDate! > Date() ? "active" : "expiring",
                issues: expirationDate != nil && expirationDate! < Date() ? ["Certification expired"] : [],
                lastAudit: nil
            ),
            skills: nil,
            scopeRules: nil,
            facilityNeeds: nil,
            clinicianId: nil
        )

        let message = expirationDate != nil
            ? "What are the revalidation requirements for my \(specialty) board certification? It expires on \(expirationDate!.formatted(date: .abbreviated, time: .omitted))."
            : "What are the revalidation requirements for my \(specialty) board certification?"

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .trainingProgram],
            initialMessage: message
        )
    }
}

