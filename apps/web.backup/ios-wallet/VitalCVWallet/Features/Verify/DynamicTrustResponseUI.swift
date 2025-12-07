//
//  DynamicTrustResponseUI.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 24
//  Dynamic trust-response UI (adapts to risk)
//

import SwiftUI

/// DynamicTrustResponseUI - UI that adapts based on trust/risk level
struct DynamicTrustResponseUI: View {
    let verificationResult: VerificationResult
    let riskAssessment: RiskAssessment

    @State private var trustLevel: TrustLevel = .medium

    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            // Dynamic header based on risk
            trustHeader

            // Risk indicators
            if riskAssessment.level != .low {
                riskIndicatorsView
            }

            // Trust breakdown
            trustBreakdownView

            // Action buttons (adapt based on risk)
            actionButtonsView
        }
        .padding()
        .background(backgroundColor)
        .cornerRadius(WalletCornerRadius.large)
        .onAppear {
            calculateTrustLevel()
        }
    }

    private var trustHeader: some View {
        VStack(spacing: WalletSpacing.md) {
            Image(systemName: trustIcon)
                .font(.system(size: 60))
                .foregroundColor(trustColor)

            Text(trustTitle)
                .font(WalletTypography.largeTitle)
                .foregroundColor(trustColor)

            Text(trustSubtitle)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var riskIndicatorsView: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Risk Factors")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            ForEach(riskAssessment.factors, id: \.self) { factor in
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.walletWarning)
                    Text(factor)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletText)
                }
            }
        }
        .padding()
        .background(Color.walletWarning.opacity(0.1))
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var trustBreakdownView: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Trust Breakdown")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            TrustMetricRow(label: "Signature", value: verificationResult.checks.first(where: { $0.name.contains("Signature") })?.passed ?? false)
            TrustMetricRow(label: "Expiration", value: verificationResult.checks.first(where: { $0.name.contains("Expiration") })?.passed ?? false)
            TrustMetricRow(label: "Issuer", value: verificationResult.checks.first(where: { $0.name.contains("Issuer") })?.passed ?? false)
            TrustMetricRow(label: "Chain Anchor", value: verificationResult.checks.first(where: { $0.name.contains("Chain") })?.passed ?? false)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var actionButtonsView: some View {
        VStack(spacing: WalletSpacing.md) {
            if riskAssessment.level == .high {
                Button("Review Details") {
                    // Show detailed review
                }
                .buttonStyle(.borderedProminent)
                .tint(.walletWarning)
            }

            if trustLevel >= .high {
                Button("Accept & Continue") {
                    // Accept credential
                }
                .buttonStyle(.borderedProminent)
                .tint(.walletSuccess)
            } else {
                Button("Proceed with Caution") {
                    // Proceed with warning
                }
                .buttonStyle(.bordered)
                .tint(.walletWarning)
            }
        }
    }

    // MARK: - Computed Properties

    private var trustIcon: String {
        switch trustLevel {
        case .verified: return "checkmark.shield.fill"
        case .high: return "shield.fill"
        case .medium: return "shield.lefthalf.filled"
        case .low: return "exclamationmark.shield.fill"
        case .untrusted: return "xmark.shield.fill"
        }
    }

    private var trustColor: Color {
        switch trustLevel {
        case .verified, .high: return .walletSuccess
        case .medium: return .walletWarning
        case .low, .untrusted: return .walletError
        }
    }

    private var trustTitle: String {
        switch trustLevel {
        case .verified: return "Verified & Trusted"
        case .high: return "High Trust"
        case .medium: return "Moderate Trust"
        case .low: return "Low Trust"
        case .untrusted: return "Untrusted"
        }
    }

    private var trustSubtitle: String {
        switch riskAssessment.level {
        case .low: return "This credential appears to be valid and trustworthy."
        case .medium: return "Some verification checks passed, but proceed with caution."
        case .high: return "Multiple risk factors detected. Review carefully before accepting."
        }
    }

    private var backgroundColor: Color {
        switch riskAssessment.level {
        case .low: return Color.walletSuccess.opacity(0.1)
        case .medium: return Color.walletWarning.opacity(0.1)
        case .high: return Color.walletError.opacity(0.1)
        }
    }

    private func calculateTrustLevel() {
        let passedChecks = verificationResult.checks.filter { $0.passed }.count
        let totalChecks = verificationResult.checks.count
        let passRate = Double(passedChecks) / Double(totalChecks)

        switch (passRate, riskAssessment.level) {
        case (0.9..., .low): trustLevel = .verified
        case (0.7..., .low): trustLevel = .high
        case (0.5..., _): trustLevel = .medium
        case (0.3..., _): trustLevel = .low
        default: trustLevel = .untrusted
        }
    }
}

// MARK: - Trust Metric Row

struct TrustMetricRow: View {
    let label: String
    let value: Bool

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.body)
                .foregroundColor(.walletText)

            Spacer()

            Image(systemName: value ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(value ? .walletSuccess : .walletError)
        }
    }
}

// MARK: - Risk Assessment

struct RiskAssessment {
    let level: RiskLevel
    let factors: [String]
    let score: Double

    enum RiskLevel {
        case low
        case medium
        case high
    }
}

#Preview {
    DynamicTrustResponseUI(
        verificationResult: VerificationResult(
            verified: true,
            credentialId: "test",
            checks: [
                VerificationCheck(name: "Signature Valid", passed: true, message: nil),
                VerificationCheck(name: "Not Expired", passed: true, message: nil),
                VerificationCheck(name: "Issuer Trusted", passed: false, message: nil)
            ],
            timestamp: Date(),
            verifier: nil,
            error: nil
        ),
        riskAssessment: RiskAssessment(
            level: .medium,
            factors: ["Issuer not in trust registry"],
            score: 0.6
        )
    )
    .padding()
    .background(Color.walletBackground)
}

