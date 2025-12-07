//
//  ZKAuthWorkflows.swift
//  VitalCVWallet
//
//  Created: Zero-Knowledge Authorization Engine - Phase 2
//  Workflow-specific ZK authorization flows
//

import Foundation
import Combine

/// ZKAuthWorkflows - Workflow-specific authorization flows
@MainActor
public class ZKAuthWorkflows {
    public static let shared = ZKAuthWorkflows()

    private let zkAuthEngine = ZKAuthEngine.shared
    private let zkIdentityEngine = ZKIdentityEngine.shared

    private init() {}

    // MARK: - Phase 2 - Task 9: Facility Onboarding Authorization

    /// ZK authorization for accessing facility onboarding
    public func authorizeFacilityOnboarding(
        facilityId: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["facilityId", "onboardingStatus"],
            hiddenAttributes: ["name", "dateOfBirth", "ssn", "address"],
            allowedReveals: ["facilityId", "onboardingStatus", "role", "licensureStatus"]
        )

        // Reveal only necessary fields
        let revealedFields: [String: String] = [
            "facilityId": facilityId,
            "onboardingStatus": "pending"
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 10: Privilege Verification

    /// ZK authorization for verifying privileges
    public func authorizePrivilegeVerification(
        privilegeType: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["privilegeType", "privilegeStatus"],
            hiddenAttributes: ["name", "licenseNumber", "deaNumber", "supervisor"],
            allowedReveals: ["privilegeType", "privilegeStatus", "department", "role"]
        )

        let revealedFields: [String: String] = [
            "privilegeType": privilegeType,
            "privilegeStatus": "verified"
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 11: Recruiter → Candidate Gatekeeping

    /// ZK authorization for recruiter gatekeeping (prove qualifications without identity)
    public func authorizeRecruiterGatekeeping(
        requiredQualifications: [String],
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: requiredQualifications,
            hiddenAttributes: ["name", "email", "phone", "address", "ssn"],
            allowedReveals: requiredQualifications + ["yearsOfExperience", "specialty"]
        )

        // Build revealed fields from qualifications
        var revealedFields: [String: String] = [:]
        for qual in requiredQualifications {
            revealedFields[qual] = "verified"
        }

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 12: Telemedicine Eligibility

    /// ZK authorization for telemedicine eligibility queries
    public func authorizeTelemedicineEligibility(
        state: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["telemedicineEligible", "state"],
            hiddenAttributes: ["name", "licenseNumber", "npi", "address"],
            allowedReveals: ["telemedicineEligible", "state", "specialty"]
        )

        let revealedFields: [String: String] = [
            "telemedicineEligible": "true",
            "state": state
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 13: Shift Assignment Confirmation

    /// ZK authorization for shift assignment confirmations
    public func authorizeShiftAssignment(
        shiftId: String,
        facilityId: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["shiftId", "facilityId", "shiftStatus"],
            hiddenAttributes: ["name", "employeeId", "ssn"],
            allowedReveals: ["shiftId", "facilityId", "shiftStatus", "role", "department"]
        )

        let revealedFields: [String: String] = [
            "shiftId": shiftId,
            "facilityId": facilityId,
            "shiftStatus": "confirmed"
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 14: ZK Role Confirmation

    /// Prove role without revealing name
    public func proveRole(
        role: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["role"],
            hiddenAttributes: ["name", "employeeId", "email", "phone"],
            allowedReveals: ["role", "department", "specialty"]
        )

        let revealedFields: [String: String] = [
            "role": role
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 15: ZK Licensure Validity Proof

    /// Prove license is active without revealing license number
    public func proveLicensureValidity(
        state: String,
        licenseType: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["licenseStatus", "state", "licenseType"],
            hiddenAttributes: ["name", "licenseNumber", "npi", "dateOfBirth"],
            allowedReveals: ["licenseStatus", "state", "licenseType", "expirationDate"]
        )

        let revealedFields: [String: String] = [
            "licenseStatus": "active",
            "state": state,
            "licenseType": licenseType
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 16: ZK DEA Status Proof

    /// Prove valid DEA schedule without revealing DEA number
    public func proveDEAStatus(
        schedule: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["deaStatus", "schedule"],
            hiddenAttributes: ["name", "deaNumber", "npi", "address"],
            allowedReveals: ["deaStatus", "schedule", "expirationDate"]
        )

        let revealedFields: [String: String] = [
            "deaStatus": "active",
            "schedule": schedule
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 17: ZK Sanctions Innocence Proof

    /// Prove no sanctions without exposing identity
    public func proveSanctionsInnocence(
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["sanctionsStatus"],
            hiddenAttributes: ["name", "npi", "licenseNumber", "dateOfBirth", "ssn"],
            allowedReveals: ["sanctionsStatus", "lastCheckedDate"]
        )

        let revealedFields: [String: String] = [
            "sanctionsStatus": "clear"
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 18: ZK Residency/Education Completion Proof

    /// Prove residency/education completion without revealing details
    public func proveEducationCompletion(
        programType: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["programType", "completionStatus"],
            hiddenAttributes: ["name", "institution", "gpa", "transcriptId"],
            allowedReveals: ["programType", "completionStatus", "completionDate", "accreditation"]
        )

        let revealedFields: [String: String] = [
            "programType": programType,
            "completionStatus": "completed"
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 19: ZK Skill Competency Proof

    /// Prove verified skill without revealing supervisor
    public func proveSkillCompetency(
        skill: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["skill", "competencyStatus"],
            hiddenAttributes: ["name", "supervisor", "supervisorEmail", "facility"],
            allowedReveals: ["skill", "competencyStatus", "verificationDate", "level"]
        )

        let revealedFields: [String: String] = [
            "skill": skill,
            "competencyStatus": "verified"
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 2 - Task 20: Authorization-Level Priority Scoring

    /// Calculate authorization priority score (strong/medium/weak)
    public func calculateAuthPriority(
        response: ZKAuthResponse
    ) -> ZKAuthPriority {
        var score: Double = 0.0

        // Factor 1: Number of hidden attributes (more hidden = stronger)
        let hiddenCount = response.proof.hiddenAttributes.count
        let totalAttributes = hiddenCount + response.revealedFields.count
        if totalAttributes > 0 {
            score += (Double(hiddenCount) / Double(totalAttributes)) * 0.4
        }

        // Factor 2: Chain anchor presence (chain-backed = stronger)
        if response.chainAnchorId != nil {
            score += 0.3
        }

        // Factor 3: DID binding signature (bound = stronger)
        if !response.signature.isEmpty {
            score += 0.2
        }

        // Factor 4: SD-JWT packet presence (selective disclosure = stronger)
        if response.sdjwtPacket != nil {
            score += 0.1
        }

        // Classify priority
        if score >= 0.8 {
            return .strong
        } else if score >= 0.5 {
            return .medium
        } else {
            return .weak
        }
    }
}

// MARK: - Supporting Types

public enum ZKAuthPriority: String, Codable {
    case strong
    case medium
    case weak
}

