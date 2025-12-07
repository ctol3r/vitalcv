//
//  CMEModels.swift
//  VitalCVWallet
//
//  Created: CME Engine - Phase 1, Tasks 2-4
//  CME/CEU data models for requirements, credits, and cycles
//

import Foundation

// MARK: - CME Requirement Model

/// CMERequirement - Defines CME requirements for a clinician
public struct CMERequirement: Codable, Identifiable, Equatable {
    public let id: String
    public let state: String? // State license jurisdiction
    public let specialty: String? // Specialty code (e.g., "207R00000X")
    public let specialtyName: String?
    public let deaRequired: Bool // DEA training requirement
    public let mateRequired: Bool // MATE Act training requirement
    public let timePeriod: CMETimePeriod // Annual or biennial
    public let requiredHours: Double // Total hours required
    public let generalHours: Double? // General CME hours
    public let specialtyHours: Double? // Specialty-specific hours
    public let controlledSubstancesHours: Double? // DEA/MATE hours
    public let effectiveDate: Date
    public let expirationDate: Date?
    public let metadata: [String: String]? // Additional requirements

    public init(
        id: String = UUID().uuidString,
        state: String? = nil,
        specialty: String? = nil,
        specialtyName: String? = nil,
        deaRequired: Bool = false,
        mateRequired: Bool = false,
        timePeriod: CMETimePeriod = .annual,
        requiredHours: Double,
        generalHours: Double? = nil,
        specialtyHours: Double? = nil,
        controlledSubstancesHours: Double? = nil,
        effectiveDate: Date = Date(),
        expirationDate: Date? = nil,
        metadata: [String: String]? = nil
    ) {
        self.id = id
        self.state = state
        self.specialty = specialty
        self.specialtyName = specialtyName
        self.deaRequired = deaRequired
        self.mateRequired = mateRequired
        self.timePeriod = timePeriod
        self.requiredHours = requiredHours
        self.generalHours = generalHours
        self.specialtyHours = specialtyHours
        self.controlledSubstancesHours = controlledSubstancesHours
        self.effectiveDate = effectiveDate
        self.expirationDate = expirationDate
        self.metadata = metadata
    }
}

// MARK: - CME Time Period

public enum CMETimePeriod: String, Codable {
    case annual = "annual"
    case biennial = "biennial"

    public var years: Int {
        switch self {
        case .annual: return 1
        case .biennial: return 2
        }
    }
}

// MARK: - CME Credit Entry Model

/// CMECreditEntry - Individual CME credit entry
public struct CMECreditEntry: Codable, Identifiable, Equatable {
    public let id: String
    public let title: String
    public let provider: String // CME provider name
    public let hours: Double // Credit hours earned
    public let category: CMECreditCategory
    public let completionDate: Date
    public let issueDate: Date? // When certificate was issued
    public let certificateUrl: String? // URL to certificate PDF
    public let certificateHash: String? // Chain digest of certificate
    public let specialty: String? // Specialty this credit applies to
    public let description: String?
    public let evidenceUploaded: Bool
    public let chainAnchored: Bool
    public let anchorTxHash: String?
    public let validityScore: Double? // AI validity check score (0-1)
    public let metadata: [String: String]?
    public let createdAt: Date
    public let updatedAt: Date

    public init(
        id: String = UUID().uuidString,
        title: String,
        provider: String,
        hours: Double,
        category: CMECreditCategory,
        completionDate: Date,
        issueDate: Date? = nil,
        certificateUrl: String? = nil,
        certificateHash: String? = nil,
        specialty: String? = nil,
        description: String? = nil,
        evidenceUploaded: Bool = false,
        chainAnchored: Bool = false,
        anchorTxHash: String? = nil,
        validityScore: Double? = nil,
        metadata: [String: String]? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.provider = provider
        self.hours = hours
        self.category = category
        self.completionDate = completionDate
        self.issueDate = issueDate
        self.certificateUrl = certificateUrl
        self.certificateHash = certificateHash
        self.specialty = specialty
        self.description = description
        self.evidenceUploaded = evidenceUploaded
        self.chainAnchored = chainAnchored
        self.anchorTxHash = anchorTxHash
        self.validityScore = validityScore
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - CME Credit Category

public enum CMECreditCategory: String, Codable {
    case general = "general"
    case specialty = "specialty"
    case controlledSubstances = "controlled_substances" // DEA/MATE
    case ethics = "ethics"
    case patientSafety = "patient_safety"
    case telemedicine = "telemedicine"

    public var displayName: String {
        switch self {
        case .general: return "General CME"
        case .specialty: return "Specialty-Specific"
        case .controlledSubstances: return "Controlled Substances"
        case .ethics: return "Ethics"
        case .patientSafety: return "Patient Safety"
        case .telemedicine: return "Telemedicine"
        }
    }
}

// MARK: - CME Cycle Model

/// CMECycle - Tracks CME compliance for a specific time period
public struct CMECycle: Codable, Identifiable, Equatable {
    public let id: String
    public let startDate: Date
    public let endDate: Date
    public let completedHours: Double
    public let requiredHours: Double
    public let requirementId: String? // Reference to CMERequirement
    public let creditEntries: [String] // Array of CMECreditEntry IDs
    public let complianceStatus: CMEComplianceStatus
    public let generalHours: Double
    public let specialtyHours: Double
    public let controlledSubstancesHours: Double
    public let daysRemaining: Int
    public let isExpired: Bool
    public let metadata: [String: String]?
    public let createdAt: Date
    public let updatedAt: Date

    public init(
        id: String = UUID().uuidString,
        startDate: Date,
        endDate: Date,
        completedHours: Double = 0.0,
        requiredHours: Double,
        requirementId: String? = nil,
        creditEntries: [String] = [],
        complianceStatus: CMEComplianceStatus = .inProgress,
        generalHours: Double = 0.0,
        specialtyHours: Double = 0.0,
        controlledSubstancesHours: Double = 0.0,
        daysRemaining: Int = 0,
        isExpired: Bool = false,
        metadata: [String: String]? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.startDate = startDate
        self.endDate = endDate
        self.completedHours = completedHours
        self.requiredHours = requiredHours
        self.requirementId = requirementId
        self.creditEntries = creditEntries
        self.complianceStatus = complianceStatus
        self.generalHours = generalHours
        self.specialtyHours = specialtyHours
        self.controlledSubstancesHours = controlledSubstancesHours
        self.daysRemaining = daysRemaining
        self.isExpired = isExpired
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var progressPercentage: Double {
        guard requiredHours > 0 else { return 0.0 }
        return min(completedHours / requiredHours, 1.0)
    }

    public var hoursRemaining: Double {
        return max(requiredHours - completedHours, 0.0)
    }
}

// MARK: - CME Compliance Status

public enum CMEComplianceStatus: String, Codable {
    case compliant = "compliant"
    case inProgress = "in_progress"
    case atRisk = "at_risk" // < 30 days remaining, not complete
    case nonCompliant = "non_compliant" // Expired and incomplete
    case expired = "expired" // Cycle expired (may still be compliant)

    public var displayName: String {
        switch self {
        case .compliant: return "Compliant"
        case .inProgress: return "In Progress"
        case .atRisk: return "At Risk"
        case .nonCompliant: return "Non-Compliant"
        case .expired: return "Expired"
        }
    }

    public var color: String {
        switch self {
        case .compliant: return "green"
        case .inProgress: return "blue"
        case .atRisk: return "orange"
        case .nonCompliant: return "red"
        case .expired: return "gray"
        }
    }
}

// MARK: - CME Compliance Score

/// CMEComplianceScore - Calculated compliance score for trust score integration
public struct CMEComplianceScore: Codable, Equatable {
    public let overallScore: Double // 0.0 - 1.0
    public let currentCycleScore: Double
    public let historicalCompliance: Double // Past cycles compliance rate
    public let categoryBreakdown: [String: Double] // Category-specific scores
    public let riskFactors: [String] // List of risk factors
    public let lastUpdated: Date

    public init(
        overallScore: Double,
        currentCycleScore: Double,
        historicalCompliance: Double = 1.0,
        categoryBreakdown: [String: Double] = [:],
        riskFactors: [String] = [],
        lastUpdated: Date = Date()
    ) {
        self.overallScore = overallScore
        self.currentCycleScore = currentCycleScore
        self.historicalCompliance = historicalCompliance
        self.categoryBreakdown = categoryBreakdown
        self.riskFactors = riskFactors
        self.lastUpdated = lastUpdated
    }
}

