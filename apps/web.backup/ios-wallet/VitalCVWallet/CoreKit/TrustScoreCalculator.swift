//
//  TrustScoreCalculator.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 15
//  Add TrustScoreCalculator (chain + issuer + compliance)
//

import Foundation

/// TrustScoreCalculator - Calculates trust scores from multiple factors
public class TrustScoreCalculator {
    public static let shared = TrustScoreCalculator()

    // Weight factors (sum should be 1.0)
    private let chainWeight: Double = 0.35
    private let issuerWeight: Double = 0.35
    private let complianceWeight: Double = 0.20
    private let cmeComplianceWeight: Double = 0.10 // CME compliance contributes 10%

    private init() {}

    /// Calculate overall trust score
    public func calculateTrustScore(
        chainStatus: ChainAnchorStatus?,
        issuerMetadata: IssuerMetadata?,
        verificationChecks: [VerificationCheck],
        cmeComplianceScore: CMEComplianceScore? = nil
    ) -> TrustScore {
        let chainScore = calculateChainScore(chainStatus: chainStatus)
        let issuerScore = calculateIssuerScore(metadata: issuerMetadata)
        let complianceScore = calculateComplianceScore(checks: verificationChecks)
        let cmeScore = calculateCMEScore(cmeComplianceScore: cmeComplianceScore)

        // Weighted average
        let overallScore = (chainScore * chainWeight) +
                         (issuerScore * issuerWeight) +
                         (complianceScore * complianceWeight) +
                         (cmeScore * cmeComplianceWeight)

        return TrustScore(
            value: overallScore,
            chainScore: chainScore,
            issuerScore: issuerScore,
            complianceScore: complianceScore
        )
    }

    // MARK: - CME Compliance Score

    private func calculateCMEScore(cmeComplianceScore: CMEComplianceScore?) -> Double {
        guard let cmeScore = cmeComplianceScore else {
            return 0.5 // Neutral score if no CME data
        }

        // Use overall CME compliance score (0.0 - 1.0)
        return cmeScore.overallScore
    }

    // MARK: - Chain Score

    private func calculateChainScore(chainStatus: ChainAnchorStatus?) -> Double {
        guard let status = chainStatus else {
            return 0.3 // No chain anchor = lower trust
        }

        switch status {
        case .confirmed:
            return 1.0
        case .pending:
            return 0.6
        case .failed:
            return 0.0
        case .unknown:
            return 0.3
        }
    }

    // MARK: - Issuer Score

    private func calculateIssuerScore(metadata: IssuerMetadata?) -> Double {
        guard let metadata = metadata else {
            return 0.5 // Unknown issuer = medium trust
        }

        var score: Double = 0.5 // Base score

        // Trusted issuer bonus
        if metadata.trusted {
            score += 0.3
        }

        // Compliance level adjustment
        switch metadata.complianceLevel {
        case .high:
            score += 0.2
        case .medium:
            score += 0.1
        case .low:
            score -= 0.1
        case .unknown:
            break
        }

        return min(max(score, 0.0), 1.0) // Clamp to [0, 1]
    }

    // MARK: - Compliance Score

    private func calculateComplianceScore(checks: [VerificationCheck]) -> Double {
        guard !checks.isEmpty else {
            return 0.0
        }

        let passedChecks = checks.filter { $0.passed }.count
        let totalChecks = checks.count

        return Double(passedChecks) / Double(totalChecks)
    }

    // MARK: - Trust Level

    public func trustLevel(from score: TrustScore) -> TrustLevel {
        if score.value >= 0.8 {
            return .high
        } else if score.value >= 0.5 {
            return .medium
        } else {
            return .low
        }
    }
}

// MARK: - Chain Anchor Status Extension

extension ChainAnchorStatus {
    public var blockHeight: Int? { nil }
    public var txHash: String? { nil }
    public var timestamp: Date? { nil }

    public var status: AnchorStatus {
        switch self {
        case .confirmed:
            return .confirmed
        case .pending:
            return .pending
        case .failed:
            return .failed
        case .unknown:
            return .unknown
        }
    }

    public enum AnchorStatus {
        case confirmed
        case pending
        case failed
        case unknown
    }
}

