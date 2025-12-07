//
//  SchedulerModels.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 1
//  Core data models for hospital scheduling system
//

import Foundation

// MARK: - Shift Models

enum ShiftType: String, Codable, CaseIterable, Identifiable {
    case day = "Day"
    case evening = "Evening"
    case night = "Night"
    case onCall = "On-Call"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .day: return "sun.max.fill"
        case .evening: return "sun.horizon.fill"
        case .night: return "moon.fill"
        case .onCall: return "phone.fill"
        }
    }

    var color: String {
        switch self {
        case .day: return "yellow"
        case .evening: return "orange"
        case .night: return "blue"
        case .onCall: return "purple"
        }
    }
}

struct Shift: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let unitId: String
    let unitName: String
    let shiftType: ShiftType
    let startTime: Date
    let endTime: Date
    let requiredCredentials: [RequiredCredential]
    let assignedProviders: [ProviderAssignment]
    let capacity: Int
    let minimumStaff: Int
    let credentialRiskLevel: CredentialRiskLevel
    let trustScore: Double?
    let complianceHeat: Double?

    var isFullyStaffed: Bool {
        assignedProviders.count >= capacity
    }

    var hasMinimumCoverage: Bool {
        assignedProviders.count >= minimumStaff
    }

    var coverageGap: Int {
        max(0, minimumStaff - assignedProviders.count)
    }
}

enum CredentialRiskLevel: String, Codable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case critical = "critical"

    var color: String {
        switch self {
        case .low: return "green"
        case .medium: return "yellow"
        case .high: return "orange"
        case .critical: return "red"
        }
    }
}

struct RequiredCredential: Codable, Equatable, Identifiable {
    let id: String
    let type: String // e.g., "RN", "ACLS", "DEA"
    let required: Bool
    let description: String?
}

struct ProviderAssignment: Codable, Equatable, Identifiable {
    let id: String
    let providerId: String
    let providerName: String
    let assignedAt: Date
    let assignedBy: String
    let trustScore: Double
    let chainAnchorId: String?
    let verificationStatus: VerificationStatus
}

enum VerificationStatus: String, Codable {
    case verified = "verified"
    case pending = "pending"
    case expired = "expired"
    case revoked = "revoked"
}

// MARK: - Provider Models

struct Provider: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let specialty: String
    let credentials: [ProviderCredential]
    let trustScore: Double
    let chainAnchorId: String?
    let chainAnchorFreshness: Date?
    let sanctions: [Sanction]
    let boardCertifications: [BoardCertification]

    var hasActiveLicense: Bool {
        credentials.contains { $0.type == "License" && $0.isActive }
    }

    var hasValidDEA: Bool {
        credentials.contains { $0.type == "DEA" && $0.isActive }
    }

    var isSanctioned: Bool {
        !sanctions.isEmpty
    }
}

struct ProviderCredential: Codable, Equatable, Identifiable {
    let id: String
    let type: String // "License", "DEA", "ACLS", etc.
    let issuer: String
    let issueDate: Date
    let expirationDate: Date?
    let isActive: Bool
    let chainAnchorId: String?
    let verificationStatus: VerificationStatus

    var isExpired: Bool {
        guard let expirationDate = expirationDate else { return false }
        return expirationDate < Date()
    }

    var daysUntilExpiry: Int? {
        guard let expirationDate = expirationDate else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: expirationDate).day ?? 0
        return days > 0 ? days : nil
    }
}

struct Sanction: Codable, Equatable, Identifiable {
    let id: String
    let type: String
    let source: String
    let date: Date
    let description: String?
}

struct BoardCertification: Codable, Equatable, Identifiable {
    let id: String
    let board: String
    let specialty: String
    let issueDate: Date
    let expirationDate: Date?
    let isActive: Bool
}

// MARK: - Eligibility Models

enum EligibilityStatus: String, Codable {
    case eligible = "eligible"
    case conditional = "conditional"
    case notEligible = "not_eligible"

    var color: String {
        switch self {
        case .eligible: return "green"
        case .conditional: return "yellow"
        case .notEligible: return "red"
        }
    }

    var label: String {
        switch self {
        case .eligible: return "Eligible"
        case .conditional: return "Conditional"
        case .notEligible: return "Not Eligible"
        }
    }
}

struct ProviderEligibility: Identifiable, Equatable {
    let providerId: String
    let providerName: String
    let status: EligibilityStatus
    let riskScore: Double // 0.0 - 1.0, lower is better
    let trustScore: Double // 0.0 - 1.0, higher is better
    let matchScore: Double // 0.0 - 1.0, how well provider matches shift requirements
    let reasons: [EligibilityReason]
    let complianceHeat: Double // 0.0 - 1.0, urgency indicator

    var id: String { providerId }

    var overallScore: Double {
        // Weighted combination: trust (40%) + match (40%) - risk (20%)
        return (trustScore * 0.4) + (matchScore * 0.4) - (riskScore * 0.2)
    }
}

struct EligibilityReason: Identifiable, Equatable {
    let id: String
    let type: ReasonType
    let message: String
    let severity: Severity

    enum ReasonType: String {
        case licenseActive = "license_active"
        case licenseExpiring = "license_expiring"
        case deaValid = "dea_valid"
        case deaExpiring = "dea_expiring"
        case specialtyMatch = "specialty_match"
        case sanctions = "sanctions"
        case boardCertification = "board_certification"
        case chainAnchorFresh = "chain_anchor_fresh"
        case chainAnchorStale = "chain_anchor_stale"
        case credentialMissing = "credential_missing"
    }

    enum Severity: String {
        case info = "info"
        case warning = "warning"
        case error = "error"
    }
}

// MARK: - Coverage Models

struct CoverageAnalysis: Identifiable {
    let id: String
    let date: Date
    let shifts: [Shift]
    let complianceScore: Double
    let weakCoverageAlerts: [CoverageAlert]
    let credentialGaps: [CredentialGap]

    var totalShifts: Int { shifts.count }
    var fullyStaffedShifts: Int { shifts.filter { $0.isFullyStaffed }.count }
    var minimumCoverageShifts: Int { shifts.filter { $0.hasMinimumCoverage }.count }
}

struct CoverageAlert: Identifiable, Equatable {
    let id: String
    let shiftId: String
    let shiftName: String
    let severity: AlertSeverity
    let message: String
    let requiredStaff: Int
    let currentStaff: Int
    let gap: Int

    enum AlertSeverity: String {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case critical = "critical"
    }
}

struct CredentialGap: Identifiable, Equatable {
    let id: String
    let shiftId: String
    let shiftName: String
    let missingCredential: String
    let requiredCount: Int
    let currentCount: Int
    let gap: Int
}

// MARK: - Roster Models

struct ProviderRoster: Identifiable {
    let id: String
    let providers: [Provider]
    let searchQuery: String
    let filters: RosterFilters

    var filteredProviders: [Provider] {
        var result = providers

        if !searchQuery.isEmpty {
            result = result.filter { provider in
                provider.name.localizedCaseInsensitiveContains(searchQuery) ||
                provider.specialty.localizedCaseInsensitiveContains(searchQuery)
            }
        }

        if filters.showOnlyEligible {
            // This would need eligibility context, simplified for now
        }

        if !filters.specialtyFilter.isEmpty {
            result = result.filter { $0.specialty == filters.specialtyFilter }
        }

        return result
    }
}

struct RosterFilters: Equatable {
    var searchQuery: String = ""
    var specialtyFilter: String = ""
    var showOnlyEligible: Bool = false
    var minTrustScore: Double = 0.0
}

