//
//  CompactDialogue.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 2
//  Compact license dialogue (IMLC, NLC, PSYPACT, etc.)
//

import Foundation

/// Dialogue module for compact license conversations
public class CompactDialogue {
    private let conversationEngine: ConversationEngine

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Check IMLC (Interstate Medical Licensure Compact) eligibility
    public func checkIMLCEligibility(
        homeState: String,
        targetStates: [String],
        clinicianId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: targetStates.map { state in
                ScopeRule(
                    ruleId: "imlc_\(state.lowercased())",
                    description: "IMLC requirements for \(state)",
                    applicableStates: [state]
                )
            },
            facilityNeeds: nil,
            clinicianId: clinicianId
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .stateBoard],
            initialMessage: "Am I eligible for IMLC licensure in \(targetStates.joined(separator: ", "))? My home state is \(homeState)."
        )
    }

    /// Check NLC (Nurse Licensure Compact) status
    public func checkNLCStatus(
        homeState: String,
        targetStates: [String]
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: targetStates.map { state in
                ScopeRule(
                    ruleId: "nlc_\(state.lowercased())",
                    description: "NLC requirements for \(state)",
                    applicableStates: [state]
                )
            },
            facilityNeeds: nil,
            clinicianId: nil
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .stateBoard],
            initialMessage: "What is my NLC status for practicing in \(targetStates.joined(separator: ", "))? My home state is \(homeState)."
        )
    }

    /// Check PSYPACT (Psychology Interjurisdictional Compact) eligibility
    public func checkPSYPACTEligibility(
        homeState: String,
        targetStates: [String]
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: targetStates.map { state in
                ScopeRule(
                    ruleId: "psypact_\(state.lowercased())",
                    description: "PSYPACT requirements for \(state)",
                    applicableStates: [state]
                )
            },
            facilityNeeds: nil,
            clinicianId: nil
        )

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .stateBoard],
            initialMessage: "Am I eligible for PSYPACT licensure in \(targetStates.joined(separator: ", "))? My home state is \(homeState)."
        )
    }
}

