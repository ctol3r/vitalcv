//
//  ComplianceRulesLibrary.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 1, Task 3
//  Compliance rules library per credential type
//

import Foundation

/// ComplianceRulesLibrary - Defines compliance rules for different credential types
public class ComplianceRulesLibrary {
    public static let shared = ComplianceRulesLibrary()

    private init() {}

    // MARK: - License Renewal Rules

    /// Get renewal reminder days for license type
    public func renewalReminderDays(for licenseType: String) -> [Int] {
        switch licenseType.lowercased() {
        case "medical", "physician", "md", "do":
            return [90, 60, 30, 14, 7] // Medical licenses: 90, 60, 30, 14, 7 days
        case "nursing", "rn", "np":
            return [60, 30, 14, 7] // Nursing: 60, 30, 14, 7 days
        case "pharmacy", "pharmd":
            return [90, 60, 30, 14] // Pharmacy: 90, 60, 30, 14 days
        case "dentistry", "dds", "dmd":
            return [60, 30, 14, 7] // Dentistry: 60, 30, 14, 7 days
        case "pa", "physician assistant":
            return [60, 30, 14, 7] // PA: 60, 30, 14, 7 days
        default:
            return [60, 30, 14, 7] // Default: 60, 30, 14, 7 days
        }
    }

    /// Get trust impact score for license renewal
    public func trustImpactForLicenseRenewal(daysUntilExpiry: Int) -> Double {
        if daysUntilExpiry <= 7 {
            return 0.15 // High impact if expiring in 7 days
        } else if daysUntilExpiry <= 30 {
            return 0.10 // Medium-high impact
        } else if daysUntilExpiry <= 60 {
            return 0.08 // Medium impact
        } else if daysUntilExpiry <= 90 {
            return 0.05 // Low-medium impact
        } else {
            return 0.03 // Low impact
        }
    }

    /// Get match score impact for expired/expiring licenses
    public func matchScoreImpactForLicense(daysUntilExpiry: Int, isExpired: Bool) -> Double {
        if isExpired {
            return -0.25 // Expired license significantly lowers match score
        } else if daysUntilExpiry <= 7 {
            return -0.15 // Expiring soon lowers match score
        } else if daysUntilExpiry <= 30 {
            return -0.10 // Expiring in 30 days
        } else if daysUntilExpiry <= 60 {
            return -0.05 // Expiring in 60 days
        } else {
            return 0.0 // No impact if > 60 days
        }
    }

    // MARK: - DEA Rules

    /// DEA renewal reminder days
    public var deaRenewalReminderDays: [Int] {
        return [90, 60, 30, 14, 7] // DEA: 90, 60, 30, 14, 7 days
    }

    /// Trust impact for DEA renewal
    public func trustImpactForDEA(daysUntilExpiry: Int) -> Double {
        if daysUntilExpiry <= 7 {
            return 0.20 // Very high impact (DEA is critical)
        } else if daysUntilExpiry <= 30 {
            return 0.15
        } else if daysUntilExpiry <= 60 {
            return 0.12
        } else if daysUntilExpiry <= 90 {
            return 0.08
        } else {
            return 0.05
        }
    }

    /// Match score impact for DEA
    public func matchScoreImpactForDEA(daysUntilExpiry: Int, isExpired: Bool) -> Double {
        if isExpired {
            return -0.30 // Expired DEA very bad for match score
        } else if daysUntilExpiry <= 7 {
            return -0.20
        } else if daysUntilExpiry <= 30 {
            return -0.15
        } else if daysUntilExpiry <= 60 {
            return -0.10
        } else {
            return 0.0
        }
    }

    // MARK: - MATE Act Rules

    /// MATE Act training requirements
    public var mateTrainingRequired: Bool {
        return true // MATE Act training is required for DEA registration
    }

    /// Trust impact for MATE Act compliance
    public func trustImpactForMATE(isCompleted: Bool) -> Double {
        return isCompleted ? 0.10 : -0.10 // +10% if completed, -10% if missing
    }

    // MARK: - CME Rules

    /// CME requirements by state/specialty
    public func cmeRequirements(for state: String?, specialty: String?) -> CMERequirement {
        // Default CME requirements
        var hoursPerCycle: Int = 50
        var cycleYears: Int = 2

        // State-specific adjustments
        if let state = state {
            switch state.uppercased() {
            case "CA", "CALIFORNIA":
                hoursPerCycle = 50
                cycleYears = 2
            case "NY", "NEW YORK":
                hoursPerCycle = 50
                cycleYears = 2
            case "TX", "TEXAS":
                hoursPerCycle = 48
                cycleYears = 2
            case "FL", "FLORIDA":
                hoursPerCycle = 40
                cycleYears = 2
            default:
                hoursPerCycle = 50
                cycleYears = 2
            }
        }

        return CMERequirement(
            hoursPerCycle: hoursPerCycle,
            cycleYears: cycleYears,
            specialty: specialty
        )
    }

    /// Trust impact for CME compliance
    public func trustImpactForCME(completionPercentage: Double) -> Double {
        if completionPercentage >= 1.0 {
            return 0.08 // Fully compliant
        } else if completionPercentage >= 0.75 {
            return 0.05 // Mostly compliant
        } else if completionPercentage >= 0.50 {
            return 0.0 // Partially compliant
        } else {
            return -0.05 // Not compliant
        }
    }

    // MARK: - Evidence Rules

    /// Check if evidence is required for credential type
    public func evidenceRequired(for credentialType: String) -> Bool {
        let typesRequiringEvidence = [
            "medical license",
            "nursing license",
            "board certification",
            "specialty certification"
        ]

        return typesRequiringEvidence.contains { credentialType.lowercased().contains($0) }
    }

    /// Trust impact for missing evidence
    public func trustImpactForMissingEvidence(credentialType: String) -> Double {
        if evidenceRequired(for: credentialType) {
            return -0.12 // Missing required evidence significantly impacts trust
        } else {
            return -0.05 // Optional evidence has lower impact
        }
    }

    // MARK: - Anchor Stale Rules

    /// Days before anchor is considered stale
    public var anchorStaleThresholdDays: Int {
        return 90 // Anchor is stale after 90 days
    }

    /// Trust impact for stale anchor
    public func trustImpactForStaleAnchor(daysSinceAnchor: Int) -> Double {
        if daysSinceAnchor > 180 {
            return -0.15 // Very stale anchor
        } else if daysSinceAnchor > 120 {
            return -0.10 // Stale anchor
        } else if daysSinceAnchor > 90 {
            return -0.05 // Approaching stale
        } else {
            return 0.0 // Fresh anchor
        }
    }

    // MARK: - Sanctions Check Rules

    /// Frequency for sanctions checks (in days)
    public var sanctionsCheckFrequencyDays: Int {
        return 365 // Annual sanctions check
    }

    /// Trust impact for sanctions check
    public func trustImpactForSanctionsCheck(isUpToDate: Bool) -> Double {
        return isUpToDate ? 0.05 : -0.10
    }

    // MARK: - Recruiter Visibility Rules

    /// Determine if task should be visible to recruiters
    public func shouldBeVisibleToRecruiters(taskType: TaskType) -> Bool {
        switch taskType {
        case .licenseRenewal, .dea, .mate, .sanctionsCheck:
            return true // Critical compliance tasks visible to recruiters
        case .cme, .evidenceMissing, .anchorStale:
            return false // Internal tasks not visible
        case .recruiterRequest, .jobCritical:
            return true // Recruiter-specific tasks
        case .credentialExpiring, .chainSnapCheck:
            return false
        }
    }
}

// MARK: - CME Requirement Model

public struct CMERequirement: Codable {
    public let hoursPerCycle: Int
    public let cycleYears: Int
    public let specialty: String?

    public init(
        hoursPerCycle: Int,
        cycleYears: Int,
        specialty: String?
    ) {
        self.hoursPerCycle = hoursPerCycle
        self.cycleYears = cycleYears
        self.specialty = specialty
    }
}

