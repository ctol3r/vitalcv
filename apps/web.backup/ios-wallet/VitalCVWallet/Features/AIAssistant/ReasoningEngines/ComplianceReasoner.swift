//
//  ComplianceReasoner.swift
//  VitalCVWallet
//
//  Created: AI Clinical Assistant - Phase 3
//  Compliance reasoning engine
//

import Foundation

/// Compliance Reasoner - Provides renewal recommendations, DEA/MATE alerts, sanctions explanations
struct ComplianceReasoner {

    /// Generate renewal recommendations
    static func generateRenewalRecommendations(context: AIAssistantContext) -> [String] {
        var recommendations: [String] = []

        // Check renewal alerts
        let urgentRenewals = context.complianceState.renewalAlerts.filter { $0.priority == .high }
        let mediumRenewals = context.complianceState.renewalAlerts.filter { $0.priority == .medium }

        if !urgentRenewals.isEmpty {
            recommendations.append("⚠️ URGENT: \(urgentRenewals.count) credential(s) expiring within 30 days:")
            for alert in urgentRenewals {
                recommendations.append("  • \(alert.credentialType) expires in \(alert.daysUntilExpiry) days")
            }
        }

        if !mediumRenewals.isEmpty {
            recommendations.append("Renew soon: \(mediumRenewals.count) credential(s) expiring within 60 days:")
            for alert in mediumRenewals {
                recommendations.append("  • \(alert.credentialType) expires in \(alert.daysUntilExpiry) days")
            }
        }

        // DEA status
        if !context.complianceState.deaStatus.registered {
            recommendations.append("⚠️ DEA registration not found - register if prescribing controlled substances")
        } else if let expirationDate = context.complianceState.deaStatus.expirationDate {
            let daysUntilExpiry = Calendar.current.dateComponents([.day], from: Date(), to: expirationDate).day ?? 0
            if daysUntilExpiry <= 60 {
                recommendations.append("⚠️ DEA registration expires in \(daysUntilExpiry) days - renew now")
            }
        }

        // MATE compliance
        if !context.complianceState.mateCompliance {
            recommendations.append("⚠️ MATE Act training required - complete training to maintain prescribing privileges")
        }

        if recommendations.isEmpty {
            recommendations.append("✅ All credentials are current - no immediate renewals needed")
        }

        return recommendations
    }

    /// Explain DEA readiness
    static func explainDEAReadiness(context: AIAssistantContext) -> String {
        var explanation = "DEA Readiness Status:\n\n"

        let deaStatus = context.complianceState.deaStatus

        if deaStatus.registered {
            explanation += "✅ DEA Registered\n"
            if let state = deaStatus.state {
                explanation += "   State: \(state)\n"
            }
            if let schedule = deaStatus.schedule {
                explanation += "   Schedule: \(schedule)\n"
            }
            if let expirationDate = deaStatus.expirationDate {
                let daysUntilExpiry = Calendar.current.dateComponents([.day], from: Date(), to: expirationDate).day ?? 0
                if daysUntilExpiry > 0 {
                    explanation += "   Expires: \(daysUntilExpiry) days\n"
                } else {
                    explanation += "   ⚠️ EXPIRED\n"
                }
            }
        } else {
            explanation += "❌ DEA Not Registered\n"
            explanation += "   If you prescribe controlled substances, you need DEA registration.\n"
        }

        // MATE compliance
        explanation += "\nMATE Act Compliance:\n"
        if context.complianceState.mateCompliance {
            explanation += "✅ MATE training completed\n"
        } else {
            explanation += "❌ MATE training required\n"
            explanation += "   Complete 8 hours of training on treating/managing patients with substance use disorders.\n"
        }

        // Recommendations
        explanation += "\nRecommendations:\n"
        if !deaStatus.registered {
            explanation += "• Register for DEA if prescribing controlled substances\n"
        }
        if let expirationDate = deaStatus.expirationDate, expirationDate < Date().addingTimeInterval(60 * 24 * 60 * 60) {
            explanation += "• Renew DEA registration before expiration\n"
        }
        if !context.complianceState.mateCompliance {
            explanation += "• Complete MATE Act training\n"
        }

        return explanation
    }

    /// Explain sanctions
    static func explainSanctions(context: AIAssistantContext) -> String {
        let sanctions = context.complianceState.sanctions

        if sanctions.isEmpty {
            return "✅ No active sanctions found. Your compliance record is clean."
        }

        var explanation = "⚠️ Active Sanctions: \(sanctions.count)\n\n"

        for sanction in sanctions {
            explanation += "• \(sanction.type) - \(sanction.severity) severity\n"
            explanation += "  Date: \(sanction.date.formatted(date: .abbreviated, time: .omitted))\n"
            if sanction.resolved {
                explanation += "  Status: Resolved ✅\n"
            } else {
                explanation += "  Status: Active ⚠️\n"
            }
            explanation += "\n"
        }

        explanation += "Recommendations:\n"
        explanation += "• Address any unresolved sanctions promptly\n"
        explanation += "• Contact the issuing authority for resolution steps\n"
        explanation += "• Update your profile once sanctions are resolved\n"

        return explanation
    }
}

