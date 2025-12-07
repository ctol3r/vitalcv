//
//  ConversationEngine+ActorToActor.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 3
//  Actor-to-Actor sequences and conflict resolution
//

import Foundation

extension ConversationEngine {

    // MARK: - Actor-to-Actor Sequences

    /// StateBoard ↔ Hospital: Verify license
    public func stateBoardToHospital(
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

        return try await startConversation(
            context: context,
            actors: [.stateBoard, .hospital],
            initialMessage: "Hospital \(hospitalId) requests verification of license \(licenseId) in \(state)"
        )
    }

    /// Hospital ↔ TrainingProgram: Send residency verification
    public func hospitalToTrainingProgram(
        trainingProgramId: String,
        hospitalId: String,
        clinicianId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: nil,
            facilityNeeds: FacilityNeeds(
                facilityId: hospitalId,
                requirements: ["residency_verification"],
                priority: "high"
            ),
            clinicianId: clinicianId
        )

        return try await startConversation(
            context: context,
            actors: [.hospital, .trainingProgram],
            initialMessage: "Hospital \(hospitalId) requests residency verification for clinician \(clinicianId) from training program \(trainingProgramId)"
        )
    }

    /// Payer ↔ DEA: Check prescribing validity
    public func payerToDEA(
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

        return try await startConversation(
            context: context,
            actors: [.payer, .dea],
            initialMessage: "Payer \(payerId) requests verification of prescribing validity for DEA #\(deaNumber)"
        )
    }

    /// Hospital ↔ AI Auditor: Explain anomaly
    public func hospitalToAIAuditor(
        anomalyDescription: String,
        credentialId: String,
        hospitalId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [credentialId],
            chainData: nil,
            compliance: ComplianceData(
                status: "anomaly_detected",
                issues: [anomalyDescription],
                lastAudit: Date()
            ),
            skills: nil,
            scopeRules: nil,
            facilityNeeds: FacilityNeeds(
                facilityId: hospitalId,
                requirements: ["anomaly_explanation"],
                priority: "critical"
            ),
            clinicianId: nil
        )

        return try await startConversation(
            context: context,
            actors: [.hospital, .aiAuditor],
            initialMessage: "Hospital \(hospitalId) requests explanation for anomaly: \(anomalyDescription)"
        )
    }

    /// Recruiter ↔ StateBoard: Request verification packet
    public func recruiterToStateBoard(
        licenseId: String,
        state: String,
        recruiterId: String
    ) async throws -> Conversation {
        let context = ConversationContext(
            credentialSet: [licenseId],
            chainData: nil,
            compliance: nil,
            skills: nil,
            scopeRules: [
                ScopeRule(
                    ruleId: "verification_\(state.lowercased())",
                    description: "License verification packet for \(state)",
                    applicableStates: [state]
                )
            ],
            facilityNeeds: nil,
            clinicianId: nil
        )

        return try await startConversation(
            context: context,
            actors: [.recruiter, .stateBoard],
            initialMessage: "Recruiter \(recruiterId) requests verification packet for license \(licenseId) in \(state)"
        )
    }

    // MARK: - Cross-Actor Conflict Resolver

    /// AI explains discrepancies between actors
    public func resolveConflict(
        conversationId: String,
        conflictingActors: [ConversationActor],
        discrepancyDescription: String
    ) async throws -> ConversationMessage {
        let conflictMessage = """
        Conflict detected between \(conflictingActors.map { $0.displayName }.joined(separator: " and ")):

        \(discrepancyDescription)

        Please explain the discrepancy and provide resolution steps.
        """

        return try await routeMessage(
            conversationId: conversationId,
            message: conflictMessage,
            targetActors: [.aiAuditor] + conflictingActors
        ).first ?? ConversationMessage(
            conversationId: conversationId,
            fromActor: .aiAuditor,
            content: "Analyzing conflict...",
            messageType: .conflict
        )
    }

    /// Request more evidence (escalation mode)
    public func requestMoreEvidence(
        conversationId: String,
        credentialId: String,
        requiredEvidence: [String],
        requestingActor: ConversationActor
    ) async throws -> ConversationMessage {
        let escalationMessage = """
        Escalation: Additional evidence required for credential \(credentialId)

        Required evidence:
        \(requiredEvidence.map { "- \($0)" }.joined(separator: "\n"))

        Please provide the requested evidence to proceed with verification.
        """

        return try await sendMessage(
            conversationId: conversationId,
            message: escalationMessage,
            fromActor: requestingActor
        )
    }

    /// State-board messaging fallback (manual → AI explanation)
    public func stateBoardFallback(
        conversationId: String,
        manualResponse: String,
        question: String
    ) async throws -> ConversationMessage {
        let fallbackMessage = """
        State Board Manual Response:
        \(manualResponse)

        Original Question:
        \(question)

        AI Explanation:
        """

        return try await routeMessage(
            conversationId: conversationId,
            message: fallbackMessage,
            targetActors: [.aiAuditor]
        ).first ?? ConversationMessage(
            conversationId: conversationId,
            fromActor: .aiAuditor,
            content: "Processing state board response...",
            messageType: .text
        )
    }
}

