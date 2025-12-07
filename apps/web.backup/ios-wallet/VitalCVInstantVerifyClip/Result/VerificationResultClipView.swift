//
//  VerificationResultClipView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 5 - Task 35
//  Verification result view (Success / Warning / Failure)
//

import SwiftUI
import UIKit

struct VerificationResultClipView: View {
    let result: VerificationResult
    @EnvironmentObject var clipState: AppClipState
    @State private var showHandoff = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Task 32: Celebration burst for success
                if result.verified {
                    CelebrationBurstView()
                }

                // Status indicator
                StatusIndicatorView(verified: result.verified, trustScore: result.trustScore)

                // Task 31: Issuer authenticity badge
                IssuerAuthenticityBadge(issuerTrust: result.issuerTrust)

                // Task 30: SD-JWT selective disclosure summary
                if result.trustScore.value >= 0.7 {
                    SelectiveDisclosureSummary(result: result)
                }

                // Task 23: Chain anchor status
                ChainAnchorStatusView(chainAnchor: result.chainAnchor)

                // Task 24: Compliance summary
                ComplianceSummaryView(compliance: result.compliance)

                // Task 25: Trust score visualization
                TrustScoreVisualization(trustScore: result.trustScore)

                // Task 36: Open in full app button
                if result.verified {
                    OpenInFullAppButton {
                        showHandoff = true
                    }
                }

                // Task 39: QR re-scan option
                RescanButton()
            }
            .padding()
        }
        .background(Color.walletBackground)
        .sheet(isPresented: $showHandoff) {
            HandoffView()
        }
        .onAppear {
            // Task 33: Haptic feedback
            if result.verified {
                HapticFeedback.shared.play(.success)
            } else {
                // Task 34: Fallback haptic for low-trust
                HapticFeedback.shared.play(.warning)
            }
        }
    }
}

// MARK: - Status Indicator

struct StatusIndicatorView: View {
    let verified: Bool
    let trustScore: TrustScore

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: verified ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: 80))
                .foregroundColor(verified ? .green : .orange)

            Text(verified ? "Candidate Verified" : "Verification Warning")
                .font(WalletTypography.title)
                .foregroundColor(.walletTextPrimary)

            Text(verified ? "Credentials verified successfully" : "Some verification checks failed")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Task 31: Issuer Authenticity Badge

struct IssuerAuthenticityBadge: View {
    let issuerTrust: IssuerTrustResult

    var body: some View {
        HStack {
            Image(systemName: issuerTrust.trusted ? "checkmark.seal.fill" : "exclamationmark.seal")
                .foregroundColor(issuerTrust.trusted ? .green : .orange)

            Text(issuerTrust.trusted ? "Verified Issuer" : "Unverified Issuer")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.walletCardBackground)
        .cornerRadius(WalletCornerRadius.small)
    }
}

// MARK: - Task 30: Selective Disclosure Summary

struct SelectiveDisclosureSummary: View {
    let result: VerificationResult

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Disclosed Information")
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            // Mini summary of disclosed fields
            Text("Credential verified with selective disclosure")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.walletCardBackground)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

// MARK: - Task 23: Chain Anchor Status

struct ChainAnchorStatusView: View {
    let chainAnchor: ChainAnchorStatus

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: chainAnchor.confirmed ? "link.circle.fill" : "link.circle")
                    .foregroundColor(chainAnchor.confirmed ? .green : .gray)

                Text("Chain Anchor")
                    .font(WalletTypography.headline)
            }

            if chainAnchor.confirmed {
                Text("Anchored to blockchain")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)

                if let txHash = chainAnchor.txHash {
                    Text(txHash.prefix(16) + "...")
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletTextSecondary)
                }
            } else {
                Text("Not anchored")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.walletCardBackground)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

// MARK: - Task 24: Compliance Summary

struct ComplianceSummaryView: View {
    let compliance: ComplianceVerdicts

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Compliance Status")
                .font(WalletTypography.headline)

            ComplianceRow(title: "DEA", status: compliance.deaStatus)
            ComplianceRow(title: "Licensure", status: compliance.licensureStatus)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.walletCardBackground)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

struct ComplianceRow: View {
    let title: String
    let status: String

    var body: some View {
        HStack {
            Text(title)
                .font(WalletTypography.body)
            Spacer()
            Text(status)
                .font(WalletTypography.caption)
                .foregroundColor(status == "active" || status == "valid" ? .green : .orange)
        }
    }
}

// MARK: - Task 25: Trust Score Visualization

struct TrustScoreVisualization: View {
    let trustScore: TrustScore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trust Score")
                .font(WalletTypography.headline)

            // Simple progress bar visualization
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                        .cornerRadius(4)

                    Rectangle()
                        .fill(trustScoreColor)
                        .frame(width: geometry.size.width * CGFloat(trustScore.value), height: 8)
                        .cornerRadius(4)
                }
            }
            .frame(height: 8)

            Text("\(Int(trustScore.value * 100))%")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
        }
        .padding()
        .background(Color.walletCardBackground)
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var trustScoreColor: Color {
        switch trustScore.level {
        case .high:
            return .green
        case .medium:
            return .orange
        case .low:
            return .red
        }
    }
}

// MARK: - Task 36: Open in Full App Button

struct OpenInFullAppButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: "arrow.up.right.square")
                Text("Open in VitalCV App")
            }
            .font(WalletTypography.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.walletPrimary)
            .cornerRadius(WalletCornerRadius.medium)
        }
    }
}

// MARK: - Task 39: Rescan Button

struct RescanButton: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        Button(action: {
            dismiss()
        }) {
            Text("Scan Another QR Code")
                .font(WalletTypography.body)
                .foregroundColor(.walletPrimary)
        }
    }
}

