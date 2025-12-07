//
//  LicenseDialogue.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 2
//  State license dialogue logic
//

import Foundation

/// Dialogue module for state license conversations
public class LicenseDialogue {
    private let conversationEngine: ConversationEngine

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Start a license verification conversation with State Board
    public func verifyLicense(
        licenseNumber: String,
        state: String,
        licenseType: String,
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
            scopeRules: [
                ScopeRule(
                    ruleId: "state_\(state.lowercased())",
                    description: "State \(state) licensing requirements",
                    applicableStates: [state]
                )
            ],
            facilityNeeds: nil,
            clinicianId: clinicianId
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .stateBoard],
            initialMessage: "I need to verify my \(licenseType) license in \(state) (License #: \(licenseNumber))"
        )
    }

    /// Check license renewal requirements
    public func checkRenewalRequirements(
        licenseId: String,
        state: String
    ) async throws -> ConversationMessage {
        // This would typically be called on an existing conversation
        // For now, create a new conversation focused on renewal
        let context = ConversationContext(
            credentialSet: [licenseId],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: [
                ScopeRule(
                    ruleId: "renewal_\(state.lowercased())",
                    description: "License renewal requirements for \(state)",
                    applicableStates: [state]
                )
            ],
            facilityNeeds: nil,
            clinicianId: nil
        )

        let conversation = try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .stateBoard],
            initialMessage: "What are the renewal requirements for my license in \(state)?"
        )

        // Return the first message from the conversation
        if let firstMessage = conversationEngine.messageHistory[conversation.id]?.first {
            return firstMessage
        }

        throw ConversationError.conversationNotFound
    }

    /// Request license verification packet for a hospital
    public func requestVerificationPacket(
        licenseId: String,
        hospitalId: String,
        state: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [licenseId],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: nil,
            facilityNeeds: FacilityNeeds(
                facilityId: hospitalId,
                requirements: ["state_license_verification"],
                priority: "high"
            ),
            clinicianId: nil
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.hospital, .stateBoard],
            initialMessage: "Hospital \(hospitalId) requests verification packet for license \(licenseId) in \(state)"
        )
    }
}

