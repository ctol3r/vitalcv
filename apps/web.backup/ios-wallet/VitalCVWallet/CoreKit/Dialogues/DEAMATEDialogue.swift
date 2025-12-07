//
//  DEAMATEDialogue.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 2
//  DEA/MATE controlled-substance dialogue logic
//

import Foundation

/// Dialogue module for DEA/MATE conversations
public class DEAMATEDialogue {
    private let conversationEngine: ConversationEngine

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Verify DEA registration
    public func verifyDEARegistration(
        deaNumber: String,
        clinicianId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: ComplianceData(
                status: "pending",
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
            actors: [.clinician, .dea],
            initialMessage: "I need to verify my DEA registration (DEA #: \(deaNumber))"
        )
    }

    /// Check MATE Act compliance
    public func checkMATECompliance(
        clinicianId: String,
        trainingCompleted: Bool
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: ComplianceData(
                status: trainingCompleted ? "compliant" : "needs_training",
                issues: trainingCompleted ? [] : ["MATE Act training required"],
                lastAudit: nil
            ),
            skills: nil,
            scopeRules: nil,
            facilityNeeds: nil,
            clinicianId: clinicianId
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .dea],
            initialMessage: trainingCompleted
                ? "I have completed MATE Act training. Please verify my compliance."
                : "What MATE Act training do I need to complete?"
        )
    }

    /// Verify prescribing validity for a payer
    public func verifyPrescribingValidity(
        deaNumber: String,
        payerId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: nil,
            facilityNeeds: nil,
            clinicianId: nil
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.payer, .dea],
            initialMessage: "Payer \(payerId) requests verification of prescribing validity for DEA #\(deaNumber)"
        )
    }
}

