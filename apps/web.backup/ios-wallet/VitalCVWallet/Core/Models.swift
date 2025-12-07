//
//  Models.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 2
//  Core data models
//

import Foundation

// MARK: - Verifiable Credential

struct VerifiableCredential: Identifiable, Codable, Equatable {
    let id: String
    let type: [String]
    let issuer: Issuer
    let issuanceDate: Date
    let expirationDate: Date?
    let credentialSubject: CredentialSubject
    let proof: Proof?
    let evidence: [Evidence]?
    let chainAnchorId: String? // Phase 2 - Chain anchor reference

    var isExpired: Bool {
        guard let expirationDate = expirationDate else { return false }
        return expirationDate < Date()
    }

    var isExpiringSoon: Bool {
        guard let expirationDate = expirationDate else { return false }
        let daysUntilExpiry = Calendar.current.dateComponents([.day], from: Date(), to: expirationDate).day ?? 0
        return daysUntilExpiry <= 45 && daysUntilExpiry > 0
    }
}

struct Issuer: Codable, Equatable {
    let id: String
    let name: String?
    let image: String?
}

struct CredentialSubject: Codable, Equatable {
    let id: String
    let type: String?
    let claims: [String: String]
}

struct Proof: Codable, Equatable {
    let type: String
    let created: Date
    let proofPurpose: String
    let verificationMethod: String
    let jws: String?
}

struct Evidence: Codable, Equatable, Identifiable {
    let id: String
    let type: String
    let timestamp: Date
    let source: String
    let description: String?
}

// MARK: - DID

struct DID: Codable, Equatable {
    let id: String
    let controller: String?
    let verificationMethod: [VerificationMethod]?
    let authentication: [String]?
    let created: Date
    let updated: Date?
}

struct VerificationMethod: Codable, Equatable {
    let id: String
    let type: String
    let controller: String
    let publicKeyMultibase: String?
    let publicKeyJwk: [String: String]?
}

// MARK: - Verification Result

struct VerificationResult: Codable, Equatable {
    let verified: Bool
    let credentialId: String
    let checks: [VerificationCheck]
    let timestamp: Date
    let verifier: String?
    let error: String?
}

struct VerificationCheck: Codable, Equatable {
    let name: String
    let passed: Bool
    let message: String?
}

// MARK: - Multi-Facility Credential Passport Models
// Phase 1 - Tasks 2 & 3: FacilityPassport and PassportPacket models

struct FacilityPassport: Identifiable, Codable, Equatable {
    let id: String
    let facilityId: String
    let facilityName: String
    let onboardingRequirements: [OnboardingRequirement]
    let complianceStatus: ComplianceStatus
    let trustScore: Double // 0.0 - 1.0
    let lastVerified: Date?
    let facilityDID: String? // Phase 1 - Task 5: DID-binding
    let chainAnchorId: String? // Phase 1 - Task 6: Chain anchor reference

    var isCompliant: Bool {
        return complianceStatus == .compliant
    }
}

enum ComplianceStatus: String, Codable, Equatable {
    case compliant
    case needsAction
    case missing
    case pendingReview
}

struct OnboardingRequirement: Identifiable, Codable, Equatable {
    let id: String
    let category: RequirementCategory
    let description: String
    let required: Bool
    let satisfied: Bool
    let satisfiedDate: Date?
}

enum RequirementCategory: String, Codable, Equatable {
    case identity
    case licensure
    case dea
    case sanctions
    case privileges
    case training
    case cme
    case immunizations // Optional future module (Phase 2 - Task 10)
}

struct PassportPacket: Codable, Equatable {
    let credentials: [VerifiableCredential]
    let evidence: [Evidence]
    let skillLogs: [SkillLog]
    let trainingPortfolio: TrainingPortfolio
    let licensure: [LicensureRecord]
    let deaMate: [DEAMATERecord]
    let cme: [CMERecord]
    let endorsements: [Endorsement]
    let generatedAt: Date
    let clinicianId: String
    let chainAnchorId: String? // Phase 1 - Task 6
}

struct SkillLog: Identifiable, Codable, Equatable {
    let id: String
    let skill: String
    let facility: String
    let loggedAt: Date
    let verified: Bool
}

struct TrainingPortfolio: Codable, Equatable {
    let trainings: [TrainingRecord]
    let certifications: [CertificationRecord]
    let totalHours: Double
}

struct TrainingRecord: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let facility: String?
    let completedDate: Date
    let hours: Double
    let certificateId: String?
}

struct CertificationRecord: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let issuer: String
    let issuedDate: Date
    let expirationDate: Date?
    let credentialId: String?
}

struct LicensureRecord: Identifiable, Codable, Equatable {
    let id: String
    let state: String
    let licenseNumber: String
    let type: String
    let issuedDate: Date
    let expirationDate: Date?
    let credentialId: String?
    let active: Bool
}

struct DEAMATERecord: Identifiable, Codable, Equatable {
    let id: String
    let type: DEAMATEType
    let number: String
    let issuedDate: Date
    let expirationDate: Date?
    let credentialId: String?
    let active: Bool
}

enum DEAMATEType: String, Codable, Equatable {
    case dea
    case mate
}

struct CMERecord: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let provider: String
    let credits: Double
    let completedDate: Date
    let credentialId: String?
}

struct Endorsement: Identifiable, Codable, Equatable {
    let id: String
    let endorserName: String
    let endorserTitle: String
    let endorserFacility: String
    let relationship: String
    let endorsementDate: Date
    let verified: Bool
}

// MARK: - Facility Requirement Models
// Phase 2 - Task 10: Requirement categories and parsing

struct FacilityRequirement: Identifiable, Codable, Equatable {
    let id: String
    let facilityId: String
    let category: RequirementCategory
    let name: String
    let description: String
    let required: Bool
    let priority: RequirementPriority
    let source: RequirementSource // PDF, web rules, etc.
    let parsedAt: Date
}

enum RequirementPriority: String, Codable, Equatable {
    case critical
    case high
    case medium
    case low
}

enum RequirementSource: String, Codable, Equatable {
    case pdf
    case webRules
    case manual
    case aiParsed // Phase 2 - Task 12
}

struct CrosswalkMatch: Identifiable, Codable, Equatable {
    let id: String
    let requirementId: String
    let credentialId: String?
    let evidenceId: String?
    let matchConfidence: Double // 0.0 - 1.0
    let matchedFields: [String]
    let matchType: MatchType
}

enum MatchType: String, Codable, Equatable {
    case exact
    case partial
    case inferred
    case missing
}

struct RequirementDelta: Identifiable, Codable, Equatable {
    let id: String
    let requirementId: String
    let requirementName: String
    let missingEvidence: [String]
    let status: DeltaStatus
    let urgency: RequirementPriority
}

enum DeltaStatus: String, Codable, Equatable {
    case missing
    case partial
    case needsVerification
    case complete
}

struct FacilityPrivilege: Identifiable, Codable, Equatable {
    let id: String
    let facilityId: String
    let privilegeType: PrivilegeType
    let department: String? // e.g., "ICU", "OR"
    let requiredCredentials: [String] // Credential IDs
    let eligibilityCriteria: [String]
    let active: Bool
}

enum PrivilegeType: String, Codable, Equatable {
    case or // Operating Room
    case icu // Intensive Care Unit
    case telemedicine
    case emergency
    case general
    case specialty
}

// MARK: - Passport Readiness Models
// Phase 3 - Task 21: Readiness Score

struct PassportReadinessScore: Codable, Equatable {
    let score: Double // 0-100
    let facilityId: String
    let facilityName: String
    let breakdown: ReadinessBreakdown
    let missingItems: [String]
    let recommendations: [String]
    let calculatedAt: Date
}

struct ReadinessBreakdown: Codable, Equatable {
    let identity: Double
    let licensure: Double
    let dea: Double
    let sanctions: Double
    let privileges: Double
    let training: Double
    let cme: Double
    let overall: Double
}

// MARK: - Facility Onboarding Models
// Phase 4

struct FacilityOnboardingStatus: Identifiable, Codable, Equatable {
    let id: String
    let facilityId: String
    let facilityName: String
    let currentPhase: OnboardingPhase
    let progress: Double // 0.0 - 1.0
    let startedAt: Date
    let completedAt: Date?
    let trustScore: Double
    let timeline: [OnboardingEvent]
}

enum OnboardingPhase: String, Codable, Equatable {
    case requirements
    case verification
    case privileges
    case finalize
    case approved
    case rejected
}

struct OnboardingEvent: Identifiable, Codable, Equatable {
    let id: String
    let phase: OnboardingPhase
    let timestamp: Date
    let actor: String // "clinician" or "facility"
    let action: String
    let metadata: [String: String]?
}

struct MultiFacilityTrustScore: Codable, Equatable {
    let clinicianId: String
    let aggregatedScore: Double // 0.0 - 1.0
    let facilityScores: [FacilityTrustScore]
    let calculatedAt: Date
}

struct FacilityTrustScore: Codable, Equatable {
    let facilityId: String
    let facilityName: String
    let score: Double
    let lastUpdated: Date
}

