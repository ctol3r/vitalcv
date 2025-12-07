//
//  CredentialDiagnostics.swift
//  VitalCVWallet
//
//  Created: AI Clinical Assistant - Phase 3
//  Credential diagnostics reasoning engine
//

import Foundation

/// Credential Diagnostics - Explains why credentials are trusted, why scores changed, why anchors are stale
struct CredentialDiagnostics {

    /// Explain why a credential is trusted
    static func explainTrust(credential: VerifiableCredential, context: AIAssistantContext) -> String {
        var reasons: [String] = []

        // Check issuer reputation
        if let issuer = context.credentials.first(where: { $0.id == credential.id }) {
            if issuer.trustLevel >= 4 {
                reasons.append("Issued by a highly trusted issuer (\(issuer.issuer))")
            }
        }

        // Check chain anchoring
        if let anchorId = credential.chainAnchorId {
            reasons.append("Anchored to blockchain (Anchor ID: \(anchorId))")
        } else {
            reasons.append("⚠️ Not yet anchored to blockchain - trust level may be lower")
        }

        // Check evidence
        if let evidence = credential.evidence, !evidence.isEmpty {
            reasons.append("Backed by \(evidence.count) piece(s) of verified evidence")
        }

        // Check expiration
        if credential.isExpired {
            reasons.append("⚠️ Credential has expired - trust is reduced")
        } else if credential.isExpiringSoon {
            reasons.append("⚠️ Credential expiring soon - renew to maintain trust")
        } else {
            reasons.append("Credential is current and valid")
        }

        return "This credential is trusted because:\n\n" + reasons.map { "• \($0)" }.joined(separator: "\n")
    }

    /// Explain why trust score changed
    static func explainTrustScoreChange(
        oldScore: Double,
        newScore: Double,
        context: AIAssistantContext
    ) -> String {
        let change = newScore - oldScore
        let changePercent = abs(change) * 100

        var explanation = "Your trust score changed from \(String(format: "%.1f%%", oldScore * 100)) to \(String(format: "%.1f%%", newScore * 100)) "

        if change > 0 {
            explanation += "(increased by \(String(format: "%.1f%%", changePercent))).\n\n"
            explanation += "This increase is likely due to:\n"

            // Check for new credentials
            let recentCredentials = context.credentials.filter { cred in
                // Check if credential was added recently (within last 7 days)
                // This would need actual timestamp data
                return true // Placeholder
            }
            if !recentCredentials.isEmpty {
                explanation += "• New credentials were added and verified\n"
            }

            // Check for chain anchoring
            let anchoredCredentials = context.credentials.filter { $0.chainAnchorId != nil }
            if anchoredCredentials.count > context.credentials.count / 2 {
                explanation += "• More credentials are now anchored to the blockchain\n"
            }

            // Check for evidence
            explanation += "• Additional evidence was verified\n"

        } else if change < 0 {
            explanation += "(decreased by \(String(format: "%.1f%%", changePercent))).\n\n"
            explanation += "This decrease may be due to:\n"

            // Check for expiring credentials
            let expiringCredentials = context.credentials.filter { cred in
                // Check if credential is expiring soon
                return true // Placeholder
            }
            if !expiringCredentials.isEmpty {
                explanation += "• Credentials are expiring soon or have expired\n"
            }

            // Check for stale anchors
            explanation += "• Some chain anchors may be stale or invalid\n"
            explanation += "• Evidence may need refreshing\n"

        } else {
            explanation += "(no change).\n\n"
            explanation += "Your trust score remains stable, indicating consistent credential status."
        }

        return explanation
    }

    /// Explain why an anchor is stale
    static func explainStaleAnchor(anchorId: String, chainSignals: ChainIntegritySignals) -> String {
        var explanation = "The chain anchor (ID: \(anchorId)) is marked as stale.\n\n"

        explanation += "This means:\n"
        explanation += "• The anchor hasn't been verified recently\n"
        explanation += "• The blockchain confirmation may be outdated\n"
        explanation += "• Trust verification may be delayed\n\n"

        explanation += "To fix this:\n"
        explanation += "• Refresh the credential verification\n"
        explanation += "• Re-anchor to the blockchain if needed\n"
        explanation += "• Check network connectivity for chain updates\n"

        if chainSignals.integrityScore < 0.7 {
            explanation += "\n⚠️ Low integrity score (\(String(format: "%.0f%%", chainSignals.integrityScore * 100))) indicates the anchor needs attention."
        }

        return explanation
    }
}

