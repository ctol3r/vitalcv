//
//  TelemedicineDialogue.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 2
//  Patient-state licensing dialogue
//

import Foundation

/// Dialogue module for telemedicine licensing conversations
public class TelemedicineDialogue {
    private let conversationEngine: ConversationEngine

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Check if clinician can see patients in a specific state
    public func canSeePatientsInState(
        patientState: String,
        clinicianLicenses: [String: String], // state -> license number
        clinicianId: String
    ) async throws -> Conversation {
        let hasLicense = clinicianLicenses[patientState] != nil

        let context = ConversationContext(
            credentialSet: Array(clinicianLicenses.values),
            chainData: nil,
            compliance: ComplianceData(
                status: hasLicense ? "compliant" : "missing",
                issues: hasLicense ? [] : ["No license in \(patientState)"],
                lastAudit: nil
            ),
            skills: nil,
            scopeRules: [
                ScopeRule(
                    ruleId: "telemedicine_\(patientState.lowercased())",
                    description: "Telemedicine licensing requirements for \(patientState)",
                    applicableStates: [patientState]
                )
            ],
            facilityNeeds: nil,
            clinicianId: clinicianId
        )

        let message = hasLicense
            ? "Can I see patients in \(patientState) via telemedicine? I have license #\(clinicianLicenses[patientState]!)."
            : "Can I see patients in \(patientState) via telemedicine? I don't currently have a license there."

        return try await conversationEngine.startConversation(
            context: context,
            actors: [.clinician, .stateBoard],
            initialMessage: message
        )
    }
}

