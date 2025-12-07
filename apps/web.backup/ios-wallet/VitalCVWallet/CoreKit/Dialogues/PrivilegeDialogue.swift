//
//  PrivilegeDialogue.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 2
//  Skills → privileges → scope dialogue
//

import Foundation

/// Dialogue module for privileging conversations
public class PrivilegeDialogue {
    private let conversationEngine: ConversationEngine

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Determine privileges based on skills
    public func determinePrivileges(
        skills: [SkillData],
        facilityId: String,
        requestedPrivileges: [String]
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: nil,
            skills: skills,
            scopeRules: nil,
            facilityNeeds: FacilityNeeds(
                facilityId: facilityId,
                requirements: requestedPrivileges,
                priority: "high"
            ),
            clinicianId: nil
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .privilegingOffice],
            initialMessage: "Based on my skills, what privileges can I be granted? Requested: \(requestedPrivileges.joined(separator: ", "))"
        )
    }

    /// Request privilege escalation
    public func requestPrivilegeEscalation(
        privilegeName: String,
        requiredSkills: [String],
        facilityId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: nil,
            skills: requiredSkills.map { skillName in
                SkillData(
                    skillId: UUID().uuidString,
                    name: skillName,
                    level: "required",
                    verified: false
                )
            },
            scopeRules: nil,
            facilityNeeds: FacilityNeeds(
                facilityId: facilityId,
                requirements: [privilegeName],
                priority: "high"
            ),
            clinicianId: nil
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .privilegingOffice, .skillSupervisor],
            initialMessage: "I need to request privilege escalation for \(privilegeName). What skills do I need to demonstrate?"
        )
    }
}

