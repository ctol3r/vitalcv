//
//  ZKAuthGating.swift
//  VitalCVWallet
//
//  Created: Zero-Knowledge Authorization Engine - Phase 5
//  ZK-powered access control across modules
//

import Foundation
import Combine

/// ZKAuthGating - ZK-powered access control for sensitive operations
@MainActor
public class ZKAuthGating {
    public static let shared = ZKAuthGating()

    private let zkAuthEngine = ZKAuthEngine.shared
    private let zkAuthWorkflows = ZKAuthWorkflows.shared
    private var activeGates: [String: ZKAuthGate] = [:]

    private init() {}

    // MARK: - Phase 5 - Task 33: ZK Gating for Sensitive Credential Views

    /// Gate access to sensitive credential views
    public func gateCredentialView(
        credentialId: String,
        did: String
    ) async throws -> ZKAuthResponse {
        return try await zkAuthWorkflows.authorizeRecruiterGatekeeping(
            requiredQualifications: ["credentialView"],
            did: did
        )
    }

    // MARK: - Phase 5 - Task 34: ZK Gating for Hospital Privileging

    /// Gate access to hospital privileging
    public func gateHospitalPrivileging(
        facilityId: String,
        privilegeType: String,
        did: String
    ) async throws -> ZKAuthResponse {
        return try await zkAuthWorkflows.authorizePrivilegeVerification(
            privilegeType: privilegeType,
            did: did
        )
    }

    // MARK: - Phase 5 - Task 35: ZK Authorization for Telemedicine Eligibility

    /// Gate telemedicine eligibility queries
    public func gateTelemedicineEligibility(
        state: String,
        did: String
    ) async throws -> ZKAuthResponse {
        return try await zkAuthWorkflows.authorizeTelemedicineEligibility(
            state: state,
            did: did
        )
    }

    // MARK: - Phase 5 - Task 36: ZK Proof for Job Application Identity Minimization

    /// Gate job application with identity minimization
    public func gateJobApplication(
        jobId: String,
        requiredQualifications: [String],
        did: String
    ) async throws -> ZKAuthResponse {
        return try await zkAuthWorkflows.authorizeRecruiterGatekeeping(
            requiredQualifications: requiredQualifications,
            did: did
        )
    }

    // MARK: - Phase 5 - Task 37: ZK Gating for Reference/Recommendation Verification

    /// Gate reference/recommendation verification
    public func gateReferenceVerification(
        referenceId: String,
        did: String
    ) async throws -> ZKAuthResponse {
        let request = try await zkAuthEngine.createAuthRequest(
            requiredAttributes: ["referenceId", "verificationStatus"],
            hiddenAttributes: ["name", "email", "phone", "relationship"],
            allowedReveals: ["referenceId", "verificationStatus", "endorsementLevel"]
        )

        let revealedFields: [String: String] = [
            "referenceId": referenceId,
            "verificationStatus": "verified"
        ]

        return try await zkAuthEngine.generateAuthResponse(
            request: request,
            did: did,
            revealedFields: revealedFields
        )
    }

    // MARK: - Phase 5 - Task 38: ZK Gating for Shift Assignment Acceptance

    /// Gate shift assignment acceptance
    public func gateShiftAssignment(
        shiftId: String,
        facilityId: String,
        did: String
    ) async throws -> ZKAuthResponse {
        return try await zkAuthWorkflows.authorizeShiftAssignment(
            shiftId: shiftId,
            facilityId: facilityId,
            did: did
        )
    }

    // MARK: - Phase 5 - Task 39: ZK Gating for Facility Onboarding Passport

    /// Gate facility onboarding passport access
    public func gateFacilityOnboardingPassport(
        facilityId: String,
        did: String
    ) async throws -> ZKAuthResponse {
        return try await zkAuthWorkflows.authorizeFacilityOnboarding(
            facilityId: facilityId,
            did: did
        )
    }

    // MARK: - Gate Management

    /// Register an active gate
    public func registerGate(_ gate: ZKAuthGate) {
        activeGates[gate.id] = gate
    }

    /// Check if gate is active
    public func isGateActive(_ gateId: String) -> Bool {
        return activeGates[gateId] != nil
    }

    /// Remove gate
    public func removeGate(_ gateId: String) {
        activeGates.removeValue(forKey: gateId)
    }
}

// MARK: - Models

public struct ZKAuthGate: Identifiable, Codable {
    public let id: String
    public let type: GateType
    public let resourceId: String
    public let authResponse: ZKAuthResponse
    public let createdAt: Date
    public let expiresAt: Date

    public init(
        id: String = UUID().uuidString,
        type: GateType,
        resourceId: String,
        authResponse: ZKAuthResponse,
        createdAt: Date = Date(),
        expiresAt: Date
    ) {
        self.id = id
        self.type = type
        self.resourceId = resourceId
        self.authResponse = authResponse
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }

    public var isExpired: Bool {
        Date() >= expiresAt
    }
}

public enum GateType: String, Codable {
    case credentialView
    case hospitalPrivileging
    case telemedicineEligibility
    case jobApplication
    case referenceVerification
    case shiftAssignment
    case facilityOnboardingPassport
}

