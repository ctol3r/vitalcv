//
//  WalletBadgeSystem.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 4
//  WalletBadgeSystem - Trust and safety badge system for credentials
//

import Foundation
import SwiftUI

/// WalletBadgeSystem - Trust and safety badge system
/// Provides visual indicators for credential trust, safety, and status
@MainActor
public class WalletBadgeSystem: ObservableObject {
    public static let shared = WalletBadgeSystem()

    private let walletCore = WalletCore.shared
    private let issuerRegistry = VerifiedIssuerRegistry.shared

    private init() {}

    // MARK: - Badge Generation

    /// Get badges for credential
    public func getBadges(for credentialId: String) -> [WalletBadge] {
        guard let credential = walletCore.getCredential(credentialId) else {
            return []
        }

        var badges: [WalletBadge] = []

        // Trust badge
        if let issuer = issuerRegistry.getIssuer(credential.issuer.id) {
            let trustLevel = issuerRegistry.getTrustLevel(credential.issuer.id)
            badges.append(.trust(trustLevel))
        }

        // Expiration badge
        if credential.isExpired {
            badges.append(.expired)
        } else if credential.isExpiringSoon {
            badges.append(.expiringSoon)
        }

        // Proof badge
        if let proof = walletCore.getProof(for: credentialId) {
            badges.append(.proof(proof.type))
        } else {
            badges.append(.noProof)
        }

        // Verification badge
        if let evidence = credential.evidence, !evidence.isEmpty {
            badges.append(.verified)
        }

        // Chain anchor badge
        // TODO: Check if credential has chain anchor
        // badges.append(.chainAnchored)

        // Safety badge
        let safetyLevel = evaluateSafety(for: credential)
        badges.append(.safety(safetyLevel))

        return badges
    }

    /// Evaluate safety level for credential
    private func evaluateSafety(for credential: VerifiableCredential) -> SafetyLevel {
        var score = 0

        // Issuer verification
        if issuerRegistry.isVerified(credential.issuer.id) {
            score += 30
        }

        // Proof presence
        if credential.proof != nil {
            score += 20
        }

        // Evidence presence
        if let evidence = credential.evidence, !evidence.isEmpty {
            score += 20
        }

        // Not expired
        if !credential.isExpired {
            score += 15
        }

        // Recent issuance
        let daysSinceIssuance = Calendar.current.dateComponents([.day], from: credential.issuanceDate, to: Date()).day ?? 0
        if daysSinceIssuance < 365 {
            score += 15
        }

        // Determine safety level
        if score >= 80 {
            return .high
        } else if score >= 50 {
            return .medium
        } else {
            return .low
        }
    }

    /// Get badge configuration for display
    public func getBadgeConfig(_ badge: WalletBadge) -> BadgeConfig {
        switch badge {
        case .trust(let level):
            switch level {
            case .high:
                return BadgeConfig(
                    title: "Verified Issuer",
                    icon: "checkmark.shield.fill",
                    color: .green,
                    priority: .high
                )
            case .medium:
                return BadgeConfig(
                    title: "Trusted Issuer",
                    icon: "shield.fill",
                    color: .blue,
                    priority: .medium
                )
            case .low:
                return BadgeConfig(
                    title: "Unverified Issuer",
                    icon: "shield.slash.fill",
                    color: .orange,
                    priority: .low
                )
            case .unknown:
                return BadgeConfig(
                    title: "Unknown Issuer",
                    icon: "questionmark.circle.fill",
                    color: .gray,
                    priority: .low
                )
            }

        case .expired:
            return BadgeConfig(
                title: "Expired",
                icon: "exclamationmark.triangle.fill",
                color: .red,
                priority: .high
            )

        case .expiringSoon:
            return BadgeConfig(
                title: "Expiring Soon",
                icon: "clock.fill",
                color: .orange,
                priority: .medium
            )

        case .proof(let type):
            switch type {
            case .bbsPlus:
                return BadgeConfig(
                    title: "BBS+ Proof",
                    icon: "lock.shield.fill",
                    color: .purple,
                    priority: .high
                )
            case .sdjwt:
                return BadgeConfig(
                    title: "SD-JWT Proof",
                    icon: "lock.fill",
                    color: .blue,
                    priority: .medium
                )
            case .jwt:
                return BadgeConfig(
                    title: "JWT Proof",
                    icon: "lock.fill",
                    color: .gray,
                    priority: .low
                )
            case .auto:
                return BadgeConfig(
                    title: "Proof Available",
                    icon: "checkmark.circle.fill",
                    color: .green,
                    priority: .medium
                )
            }

        case .noProof:
            return BadgeConfig(
                title: "No Proof",
                icon: "xmark.circle.fill",
                color: .red,
                priority: .high
            )

        case .verified:
            return BadgeConfig(
                title: "Verified",
                icon: "checkmark.seal.fill",
                color: .green,
                priority: .high
            )

        case .chainAnchored:
            return BadgeConfig(
                title: "Chain Anchored",
                icon: "link.circle.fill",
                color: .blue,
                priority: .high
            )

        case .safety(let level):
            switch level {
            case .high:
                return BadgeConfig(
                    title: "Safe",
                    icon: "checkmark.shield.fill",
                    color: .green,
                    priority: .high
                )
            case .medium:
                return BadgeConfig(
                    title: "Moderate Safety",
                    icon: "shield.fill",
                    color: .yellow,
                    priority: .medium
                )
            case .low:
                return BadgeConfig(
                    title: "Low Safety",
                    icon: "exclamationmark.shield.fill",
                    color: .orange,
                    priority: .high
                )
            }
        }
    }
}

// MARK: - Models

public enum WalletBadge {
    case trust(TrustLevel)
    case expired
    case expiringSoon
    case proof(ProofType)
    case noProof
    case verified
    case chainAnchored
    case safety(SafetyLevel)
}

public enum SafetyLevel {
    case high
    case medium
    case low
}

public struct BadgeConfig {
    public let title: String
    public let icon: String
    public let color: Color
    public let priority: BadgePriority

    public init(title: String, icon: String, color: Color, priority: BadgePriority) {
        self.title = title
        self.icon = icon
        self.color = color
        self.priority = priority
    }
}

public enum BadgePriority {
    case high
    case medium
    case low
}

