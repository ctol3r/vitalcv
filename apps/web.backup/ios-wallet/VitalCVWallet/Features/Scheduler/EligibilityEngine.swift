//
//  EligibilityEngine.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 2, Task 9
//  EligibilityEngine: Core intelligence for shift eligibility
//

import Foundation

/// EligibilityEngine - Determines provider eligibility for specific shifts
/// Evaluates license status, DEA validity, specialty matching, sanctions,
/// board certifications, and chain anchor freshness
class EligibilityEngine {
    static let shared = EligibilityEngine()

    private let trustScoreCalculator = TrustScoreCalculator.shared
    private let maxStaleAnchorDays = 30 // Chain anchor considered stale after 30 days

    private init() {}

    // MARK: - Main Eligibility Check

    /// Evaluate provider eligibility for a specific shift
    func evaluateEligibility(
        provider: Provider,
        shift: Shift
    ) -> ProviderEligibility {
        var reasons: [EligibilityReason] = []
        var riskScore: Double = 0.0
        var matchScore: Double = 0.0

        // Check license active
        let licenseCheck = checkLicenseActive(provider: provider)
        reasons.append(contentsOf: licenseCheck.reasons)
        riskScore += licenseCheck.riskContribution

        // Check DEA valid (if required)
        if shift.requiredCredentials.contains(where: { $0.type == "DEA" && $0.required }) {
            let deaCheck = checkDEAValid(provider: provider)
            reasons.append(contentsOf: deaCheck.reasons)
            riskScore += deaCheck.riskContribution
        }

        // Check specialty matches unit
        let specialtyCheck = checkSpecialtyMatch(provider: provider, shift: shift)
        reasons.append(contentsOf: specialtyCheck.reasons)
        matchScore += specialtyCheck.matchContribution

        // Check sanctions
        let sanctionsCheck = checkSanctions(provider: provider)
        reasons.append(contentsOf: sanctionsCheck.reasons)
        riskScore += sanctionsCheck.riskContribution

        // Check board certification (optional per hospital)
        let boardCertCheck = checkBoardCertification(provider: provider, shift: shift)
        reasons.append(contentsOf: boardCertCheck.reasons)
        matchScore += boardCertCheck.matchContribution

        // Check chain anchor freshness
        let anchorCheck = checkChainAnchorFreshness(provider: provider)
        reasons.append(contentsOf: anchorCheck.reasons)
        riskScore += anchorCheck.riskContribution

        // Check required credentials
        let credentialCheck = checkRequiredCredentials(provider: provider, shift: shift)
        reasons.append(contentsOf: credentialCheck.reasons)
        riskScore += credentialCheck.riskContribution
        matchScore += credentialCheck.matchContribution

        // Normalize scores
        riskScore = min(riskScore, 1.0)
        matchScore = min(matchScore, 1.0)

        // Calculate trust score
        let trustScore = provider.trustScore

        // Calculate compliance heat (urgency indicator)
        let complianceHeat = calculateComplianceHeat(
            riskScore: riskScore,
            reasons: reasons
        )

        // Determine eligibility status
        let status = determineEligibilityStatus(
            riskScore: riskScore,
            matchScore: matchScore,
            trustScore: trustScore,
            reasons: reasons
        )

        return ProviderEligibility(
            providerId: provider.id,
            providerName: provider.name,
            status: status,
            riskScore: riskScore,
            trustScore: trustScore,
            matchScore: matchScore,
            reasons: reasons,
            complianceHeat: complianceHeat
        )
    }

    // MARK: - Individual Checks

    private func checkLicenseActive(provider: Provider) -> CheckResult {
        var reasons: [EligibilityReason] = []
        var riskContribution: Double = 0.0

        guard let license = provider.credentials.first(where: { $0.type == "License" }) else {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .credentialMissing,
                message: "No active license found",
                severity: .error
            ))
            riskContribution = 1.0
            return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: 0.0)
        }

        if !license.isActive {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .licenseActive,
                message: "License is not active",
                severity: .error
            ))
            riskContribution = 1.0
        } else if license.isExpired {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .licenseExpiring,
                message: "License has expired",
                severity: .error
            ))
            riskContribution = 1.0
        } else if let daysUntilExpiry = license.daysUntilExpiry, daysUntilExpiry <= 30 {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .licenseExpiring,
                message: "License expires in \(daysUntilExpiry) days",
                severity: .warning
            ))
            riskContribution = Double(30 - daysUntilExpiry) / 30.0 * 0.5
        } else {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .licenseActive,
                message: "License is active and valid",
                severity: .info
            ))
        }

        return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: 0.0)
    }

    private func checkDEAValid(provider: Provider) -> CheckResult {
        var reasons: [EligibilityReason] = []
        var riskContribution: Double = 0.0

        guard let dea = provider.credentials.first(where: { $0.type == "DEA" }) else {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .credentialMissing,
                message: "DEA registration required but not found",
                severity: .error
            ))
            riskContribution = 1.0
            return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: 0.0)
        }

        if !dea.isActive {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .deaValid,
                message: "DEA registration is not active",
                severity: .error
            ))
            riskContribution = 1.0
        } else if dea.isExpired {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .deaExpiring,
                message: "DEA registration has expired",
                severity: .error
            ))
            riskContribution = 1.0
        } else if let daysUntilExpiry = dea.daysUntilExpiry, daysUntilExpiry <= 30 {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .deaExpiring,
                message: "DEA registration expires in \(daysUntilExpiry) days",
                severity: .warning
            ))
            riskContribution = Double(30 - daysUntilExpiry) / 30.0 * 0.5
        } else {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .deaValid,
                message: "DEA registration is valid",
                severity: .info
            ))
        }

        return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: 0.0)
    }

    private func checkSpecialtyMatch(provider: Provider, shift: Shift) -> CheckResult {
        var reasons: [EligibilityReason] = []
        var matchContribution: Double = 0.0

        // Simple specialty matching - can be enhanced with taxonomy matching
        let providerSpecialty = provider.specialty.lowercased()
        let unitName = shift.unitName.lowercased()

        // Check if specialty matches unit requirements
        // This is a simplified check - real implementation would use taxonomy matching
        if providerSpecialty.contains(unitName) || unitName.contains(providerSpecialty) {
            matchContribution = 1.0
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .specialtyMatch,
                message: "Specialty matches unit requirements",
                severity: .info
            ))
        } else {
            matchContribution = 0.5
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .specialtyMatch,
                message: "Specialty may not fully match unit requirements",
                severity: .warning
            ))
        }

        return CheckResult(reasons: reasons, riskContribution: 0.0, matchContribution: matchContribution)
    }

    private func checkSanctions(provider: Provider) -> CheckResult {
        var reasons: [EligibilityReason] = []
        var riskContribution: Double = 0.0

        if provider.isSanctioned {
            let sanctionCount = provider.sanctions.count
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .sanctions,
                message: "\(sanctionCount) sanction(s) on record",
                severity: .error
            ))
            riskContribution = min(Double(sanctionCount) * 0.3, 1.0)
        } else {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .sanctions,
                message: "No sanctions on record",
                severity: .info
            ))
        }

        return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: 0.0)
    }

    private func checkBoardCertification(provider: Provider, shift: Shift) -> CheckResult {
        var reasons: [EligibilityReason] = []
        var matchContribution: Double = 0.0

        // Check if board certification is required (optional per hospital)
        // For now, we'll check if provider has any active board certifications
        let activeCertifications = provider.boardCertifications.filter { $0.isActive }

        if activeCertifications.isEmpty {
            matchContribution = 0.5
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .boardCertification,
                message: "No active board certifications",
                severity: .warning
            ))
        } else {
            matchContribution = 1.0
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .boardCertification,
                message: "\(activeCertifications.count) active board certification(s)",
                severity: .info
            ))
        }

        return CheckResult(reasons: reasons, riskContribution: 0.0, matchContribution: matchContribution)
    }

    private func checkChainAnchorFreshness(provider: Provider) -> CheckResult {
        var reasons: [EligibilityReason] = []
        var riskContribution: Double = 0.0

        guard let anchorDate = provider.chainAnchorFreshness else {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .chainAnchorStale,
                message: "No chain anchor found",
                severity: .warning
            ))
            riskContribution = 0.3
            return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: 0.0)
        }

        let daysSinceAnchor = Calendar.current.dateComponents([.day], from: anchorDate, to: Date()).day ?? 0

        if daysSinceAnchor > maxStaleAnchorDays {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .chainAnchorStale,
                message: "Chain anchor stale (\(daysSinceAnchor) days old)",
                severity: .warning
            ))
            riskContribution = min(Double(daysSinceAnchor - maxStaleAnchorDays) / 30.0, 0.5)
        } else {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .chainAnchorFresh,
                message: "Chain anchor is fresh (\(daysSinceAnchor) days old)",
                severity: .info
            ))
        }

        return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: 0.0)
    }

    private func checkRequiredCredentials(provider: Provider, shift: Shift) -> CheckResult {
        var reasons: [EligibilityReason] = []
        var riskContribution: Double = 0.0
        var matchContribution: Double = 0.0

        let requiredCreds = shift.requiredCredentials.filter { $0.required }
        var missingCreds: [String] = []
        var presentCreds: [String] = []

        for requiredCred in requiredCreds {
            let hasCred = provider.credentials.contains { cred in
                cred.type == requiredCred.type && cred.isActive && !cred.isExpired
            }

            if hasCred {
                presentCreds.append(requiredCred.type)
            } else {
                missingCreds.append(requiredCred.type)
            }
        }

        if !missingCreds.isEmpty {
            reasons.append(EligibilityReason(
                id: UUID().uuidString,
                type: .credentialMissing,
                message: "Missing required credentials: \(missingCreds.joined(separator: ", "))",
                severity: .error
            ))
            riskContribution = Double(missingCreds.count) / Double(requiredCreds.count)
        }

        if !presentCreds.isEmpty {
            matchContribution = Double(presentCreds.count) / Double(requiredCreds.count)
        }

        return CheckResult(reasons: reasons, riskContribution: riskContribution, matchContribution: matchContribution)
    }

    // MARK: - Helper Methods

    private func calculateComplianceHeat(
        riskScore: Double,
        reasons: [EligibilityReason]
    ) -> Double {
        // Base heat from risk score
        var heat = riskScore

        // Increase heat for errors
        let errorCount = reasons.filter { $0.severity == .error }.count
        heat += Double(errorCount) * 0.2

        // Increase heat for warnings
        let warningCount = reasons.filter { $0.severity == .warning }.count
        heat += Double(warningCount) * 0.1

        return min(heat, 1.0)
    }

    private func determineEligibilityStatus(
        riskScore: Double,
        matchScore: Double,
        trustScore: Double,
        reasons: [EligibilityReason]
    ) -> EligibilityStatus {
        // Check for critical errors
        let hasCriticalErrors = reasons.contains { reason in
            reason.severity == .error && (
                reason.type == .licenseActive ||
                reason.type == .deaValid ||
                reason.type == .sanctions ||
                reason.type == .credentialMissing
            )
        }

        if hasCriticalErrors || riskScore > 0.7 {
            return .notEligible
        }

        // Check for warnings or moderate risk
        let hasWarnings = reasons.contains { $0.severity == .warning }

        if hasWarnings || riskScore > 0.3 || matchScore < 0.7 || trustScore < 0.5 {
            return .conditional
        }

        return .eligible
    }

    // MARK: - Sorting

    /// Sort providers by eligibility for a shift
    func sortProvidersByEligibility(
        providers: [Provider],
        shift: Shift
    ) -> [ProviderEligibility] {
        let eligibilities = providers.map { provider in
            evaluateEligibility(provider: provider, shift: shift)
        }

        return eligibilities.sorted { eligibility1, eligibility2 in
            // Sort by status first (eligible > conditional > not eligible)
            let statusOrder: [EligibilityStatus: Int] = [
                .eligible: 0,
                .conditional: 1,
                .notEligible: 2
            ]

            let status1Order = statusOrder[eligibility1.status] ?? 999
            let status2Order = statusOrder[eligibility2.status] ?? 999

            if status1Order != status2Order {
                return status1Order < status2Order
            }

            // Then by overall score (higher is better)
            return eligibility1.overallScore > eligibility2.overallScore
        }
    }
}

// MARK: - Helper Structures

private struct CheckResult {
    let reasons: [EligibilityReason]
    let riskContribution: Double
    let matchContribution: Double
}

