//
//  ResumeModels.swift
//  VitalCVWallet
//
//  Created: Smart Resume Generator - Phase 1
//  Resume data models and structures
//

import Foundation
import SwiftUI

// MARK: - Resume Model

/// ResumeModel - Unified résumé data structure
struct ResumeModel: Identifiable, Codable, Equatable {
    let id: String
    let clinicianId: String

    // Personal Information
    let name: String
    let degree: String?
    let specialty: String?
    let headlineSummary: String?
    let identityOrbColor: String? // Hex color for identity orb
    let didHash: String? // DID hash for verification

    // Contact Information (optional, can be hidden)
    var phone: String?
    var email: String?
    var city: String?
    var state: String?

    // Resume Sections
    let licensure: [LicenseCredential]
    let boardCertifications: [BoardCertification]
    let deaMate: [DEAMATE]
    let employment: [Employment]
    let education: [Education]
    let certifications: [Certification]

    // Trust & Verification
    let endorsements: [Endorsement]
    let verifiedReferences: [Reference]
    let trustScore: Double
    let anchorIntegritySummary: AnchorIntegritySummary

    // Metadata
    let createdAt: Date
    let updatedAt: Date
    let version: Int

    // Selective Disclosure Rules
    var disclosureRules: DisclosureRules

    init(
        id: String = UUID().uuidString,
        clinicianId: String,
        name: String,
        degree: String? = nil,
        specialty: String? = nil,
        headlineSummary: String? = nil,
        identityOrbColor: String? = nil,
        didHash: String? = nil,
        phone: String? = nil,
        email: String? = nil,
        city: String? = nil,
        state: String? = nil,
        licensure: [LicenseCredential] = [],
        boardCertifications: [BoardCertification] = [],
        deaMate: [DEAMATE] = [],
        employment: [Employment] = [],
        education: [Education] = [],
        certifications: [Certification] = [],
        endorsements: [Endorsement] = [],
        verifiedReferences: [Reference] = [],
        trustScore: Double = 0.0,
        anchorIntegritySummary: AnchorIntegritySummary = AnchorIntegritySummary(),
        disclosureRules: DisclosureRules = DisclosureRules(),
        version: Int = 1
    ) {
        self.id = id
        self.clinicianId = clinicianId
        self.name = name
        self.degree = degree
        self.specialty = specialty
        self.headlineSummary = headlineSummary
        self.identityOrbColor = identityOrbColor
        self.didHash = didHash
        self.phone = phone
        self.email = email
        self.city = city
        self.state = state
        self.licensure = licensure
        self.boardCertifications = boardCertifications
        self.deaMate = deaMate
        self.employment = employment
        self.education = education
        self.certifications = certifications
        self.endorsements = endorsements
        self.verifiedReferences = verifiedReferences
        self.trustScore = trustScore
        self.anchorIntegritySummary = anchorIntegritySummary
        self.disclosureRules = disclosureRules
        self.createdAt = Date()
        self.updatedAt = Date()
        self.version = version
    }
}

// MARK: - Credential Types

/// LicenseCredential - Medical license information
struct LicenseCredential: Identifiable, Codable, Equatable {
    let id: String
    let type: String // e.g., "Medical License", "RN License"
    let state: String
    let number: String
    let issuedDate: Date
    let expirationDate: Date?
    let status: String // "Active", "Expired", "Suspended"
    let issuer: String
    let credentialId: String? // Reference to VerifiableCredential
    let chainAnchored: Bool

    var isActive: Bool {
        guard let expirationDate = expirationDate else { return status == "Active" }
        return status == "Active" && expirationDate > Date()
    }

    var yearsHeld: Int? {
        let calendar = Calendar.current
        return calendar.dateComponents([.year], from: issuedDate, to: Date()).year
    }
}

/// BoardCertification - Board certification credential
struct BoardCertification: Identifiable, Codable, Equatable {
    let id: String
    let boardName: String
    let specialty: String
    let certificationName: String
    let issuedDate: Date
    let expirationDate: Date?
    let status: String
    let credentialId: String?
    let chainAnchored: Bool

    var isActive: Bool {
        guard let expirationDate = expirationDate else { return status == "Active" }
        return status == "Active" && expirationDate > Date()
    }
}

/// DEAMATE - DEA or MATE certification
struct DEAMATE: Identifiable, Codable, Equatable {
    let id: String
    let type: String // "DEA" or "MATE"
    let number: String
    let issuedDate: Date
    let expirationDate: Date?
    let status: String
    let credentialId: String?
    let chainAnchored: Bool

    var isActive: Bool {
        guard let expirationDate = expirationDate else { return status == "Active" }
        return status == "Active" && expirationDate > Date()
    }
}

/// Employment - Employment history
struct Employment: Identifiable, Codable, Equatable {
    let id: String
    let organization: String
    let title: String
    let location: String?
    let startDate: Date
    let endDate: Date?
    let isCurrent: Bool
    let description: String?
    let credentialId: String? // Reference if verified via credential

    var durationMonths: Int {
        let calendar = Calendar.current
        let end = endDate ?? Date()
        let components = calendar.dateComponents([.month], from: startDate, to: end)
        return components.month ?? 0
    }

    var yearsOfExperience: Double {
        return Double(durationMonths) / 12.0
    }
}

/// Education - Education history
struct Education: Identifiable, Codable, Equatable {
    let id: String
    let institution: String
    let degree: String
    let field: String?
    let graduationDate: Date?
    let credentialId: String?

    var yearGraduated: Int? {
        guard let graduationDate = graduationDate else { return nil }
        return Calendar.current.component(.year, from: graduationDate)
    }
}

/// Certification - Additional certifications
struct Certification: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let issuer: String
    let issuedDate: Date
    let expirationDate: Date?
    let credentialId: String?
    let chainAnchored: Bool

    var isActive: Bool {
        guard let expirationDate = expirationDate else { return true }
        return expirationDate > Date()
    }
}

// MARK: - Endorsements & References

/// Endorsement - Professional endorsement
struct Endorsement: Identifiable, Codable, Equatable {
    let id: String
    let endorserName: String
    let endorserTitle: String?
    let endorserOrganization: String?
    let content: String
    let date: Date
    let verified: Bool
}

/// Reference - Professional reference
struct Reference: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let title: String
    let organization: String
    let phone: String?
    let email: String?
    let relationship: String
    let verified: Bool
}

// MARK: - Trust & Integrity

/// AnchorIntegritySummary - Chain anchor integrity information
struct AnchorIntegritySummary: Codable, Equatable {
    let totalAnchored: Int
    let totalCredentials: Int
    let lastAnchoredDate: Date?
    let chainBlockNumber: String?
    let integrityScore: Double

    init(
        totalAnchored: Int = 0,
        totalCredentials: Int = 0,
        lastAnchoredDate: Date? = nil,
        chainBlockNumber: String? = nil,
        integrityScore: Double = 0.0
    ) {
        self.totalAnchored = totalAnchored
        self.totalCredentials = totalCredentials
        self.lastAnchoredDate = lastAnchoredDate
        self.chainBlockNumber = chainBlockNumber
        self.integrityScore = integrityScore
    }

    var anchoredPercentage: Double {
        guard totalCredentials > 0 else { return 0.0 }
        return Double(totalAnchored) / Double(totalCredentials) * 100.0
    }
}

// MARK: - Disclosure Rules

/// DisclosureRules - Rules for selective disclosure per resume type
struct DisclosureRules: Codable, Equatable {
    var showPhone: Bool = true
    var showEmail: Bool = true
    var showCity: Bool = true
    var showDID: Bool = false
    var showTrustScore: Bool = true
    var showChainDetails: Bool = true
    var recruiterSafeMode: Bool = false

    // Role targeting
    var targetRole: String?
    var prioritizeRelevantCredentials: Bool = false

    // Resume type specific rules
    var resumeType: ResumeType = .standard

    enum ResumeType: String, Codable {
        case standard = "Standard"
        case recruiter = "Recruiter"
        case academic = "Academic"
        case minimal = "Minimal"
    }
}

// MARK: - Resume Template Variants

enum ResumeTemplate: String, CaseIterable, Identifiable {
    case classic = "Classic"
    case modern = "Modern"
    case minimal = "Minimal"

    var id: String { rawValue }

    var description: String {
        switch self {
        case .classic:
            return "Traditional format with clear sections"
        case .modern:
            return "Contemporary design with visual elements"
        case .minimal:
            return "Clean, minimalist layout"
        }
    }
}

// MARK: - Resume Configuration

struct ResumeConfiguration: Codable, Equatable {
    var template: ResumeTemplate = .modern
    var layout: LayoutType = .singleColumn
    var density: DensityType = .standard
    var palette: ColorPalette = .neutral
    var shortMode: Bool = false // 1-page auto-compress
    var watermark: WatermarkType = .none

    enum LayoutType: String, Codable {
        case singleColumn = "One Column"
        case twoColumn = "Two Column"
    }

    enum DensityType: String, Codable {
        case compact = "Compact"
        case standard = "Standard"
        case expanded = "Expanded"
    }

    enum ColorPalette: String, Codable {
        case neutral = "Neutral"
        case clinical = "Clinical"
        case dark = "Dark"
    }

    enum WatermarkType: String, Codable {
        case none = "None"
        case vitalcv = "VitalCV"
        case facility = "Facility"
    }
}








