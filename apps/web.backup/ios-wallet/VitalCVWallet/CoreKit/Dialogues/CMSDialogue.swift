//
//  CMSDialogue.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 2
//  CMS/PECOS enrollment + Medicare dialogue
//

import Foundation

/// Dialogue module for CMS/PECOS conversations
public class CMSDialogue {
    private let conversationEngine: ConversationEngine

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Verify PECOS enrollment
    public func verifyPECOSEnrollment(
        npi: String,
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
            actors: [.clinician, .cmsPecos],
            initialMessage: "I need to verify my PECOS enrollment status (NPI: \(npi))"
        )
    }

    /// Check Medicare enrollment status
    public func checkMedicareEnrollment(
        npi: String,
        enrollmentType: String
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
            actors: [.clinician, .cmsPecos],
            initialMessage: "What is my Medicare enrollment status for \(enrollmentType)? (NPI: \(npi))"
        )
    }
}

