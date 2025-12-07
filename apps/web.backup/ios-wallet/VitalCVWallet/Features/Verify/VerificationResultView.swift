//
//  VerificationResultView.swift
//  VitalCVWallet
//
//  Created: Phase 5 - Result Screen
//  The final moment. The truth delivered.
//

import SwiftUI

// MARK: - Task 35: VerificationResultView

struct VerificationResultView: View {
    let result: VerificationResult
    @State private var showingShareSheet = false
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: WalletSpacing.xl) {
                // Result header
                resultHeader

                // Task 36: Trust score arc visualization
                TrustScoreArcView(trustScore: result.trustScore)
                    .padding()

                // Task 37: Chain anchor summary card
                ChainAnchorCard(chainAnchor: result.chainAnchor)
                    .padding(.horizontal)

                // Task 38: Compliance summary card
                ComplianceCard(compliance: result.compliance)
                    .padding(.horizontal)

                // Task 34: Trust explainer
                TrustExplainerView(trustScore: result.trustScore)
                    .padding(.horizontal)

                // Action buttons
                actionButtons
            }
            .padding()
        }
        .navigationTitle("Verification Result")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Done") {
                    dismiss()
                }
            }
        }
        .sheet(isPresented: $showingShareSheet) {
            ShareProofView(result: result)
        }
    }

    private var resultHeader: some View {
        VStack(spacing: WalletSpacing.md) {
            // Status icon
            Image(systemName: result.verified ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(result.verified ? .green : .red)
                .trustGlow(score: result.trustScore.value)

            // Status text
            Text(result.verified ? "Verification Successful" : "Verification Failed")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)

            // Credential ID
            Text("Credential: \(result.credentialId)")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
                .padding(.horizontal)
        }
        .padding()
    }

    private var actionButtons: some View {
        VStack(spacing: WalletSpacing.md) {
            // Task 39: Re-verify button
            Button(action: {
                // Re-verify logic
            }) {
                Text("Re-verify Now")
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.large)
            }

            // Task 40: Share proof button
            Button(action: {
                showingShareSheet = true
            }) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                    Text("Share Proof")
                }
                .font(WalletTypography.headline)
                .foregroundColor(.walletPrimary)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.large)
            }
        }
        .padding(.horizontal)
    }
}

// MARK: - Task 36: Trust Score Arc Visualization

struct TrustScoreArcView: View {
    let trustScore: TrustScore
    @State private var animationProgress: Double = 0.0

    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            // Overall score
            ZStack {
                // Background circle
                Circle()
                    .stroke(Color.walletCard, lineWidth: 20)
                    .frame(width: 200, height: 200)

                // Overall score arc
                Circle()
                    .trim(from: 0, to: animationProgress * trustScore.value)
                    .stroke(
                        LinearGradient(
                            colors: [.green, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 20, lineCap: .round)
                    )
                    .frame(width: 200, height: 200)
                    .rotationEffect(.degrees(-90))

                // Score text
                VStack {
                    Text("\(Int(trustScore.value * 100))")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.walletText)
                    Text("Trust Score")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            // Multi-ring visualization
            HStack(spacing: WalletSpacing.lg) {
                TrustRing(
                    label: "Issuer",
                    score: trustScore.issuerScore,
                    color: .blue
                )

                TrustRing(
                    label: "Chain",
                    score: trustScore.chainScore,
                    color: .green
                )

                TrustRing(
                    label: "Evidence",
                    score: trustScore.complianceScore,
                    color: .orange
                )
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 1.0)) {
                animationProgress = 1.0
            }
        }
    }
}

struct TrustRing: View {
    let label: String
    let score: Double
    let color: Color
    @State private var progress: Double = 0.0

    var body: some View {
        VStack(spacing: WalletSpacing.xs) {
            ZStack {
                Circle()
                    .stroke(color.opacity(0.2), lineWidth: 8)
                    .frame(width: 80, height: 80)

                Circle()
                    .trim(from: 0, to: progress * score)
                    .stroke(color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .frame(width: 80, height: 80)
                    .rotationEffect(.degrees(-90))

                Text("\(Int(score * 100))")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletText)
            }

            Text(label)
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                progress = 1.0
            }
        }
    }
}

// MARK: - Task 37: Chain Anchor Card

struct ChainAnchorCard: View {
    let chainAnchor: ChainAnchorStatus

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            HStack {
                Image(systemName: "link")
                    .foregroundColor(.walletPrimary)
                Text("Chain Anchor")
                    .font(WalletTypography.headline)
                Spacer()
                if chainAnchor.confirmed {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }

            if chainAnchor.confirmed {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    if let blockHeight = chainAnchor.blockHeight {
                        InfoRow(label: "Block Height", value: "\(blockHeight)")
                    }

                    if let txHash = chainAnchor.txHash {
                        InfoRow(label: "Transaction", value: String(txHash.prefix(16)) + "...")
                    }

                    if let timestamp = chainAnchor.timestamp {
                        InfoRow(label: "Timestamp", value: formatDate(timestamp))
                    }

                    if let ledgerId = chainAnchor.ledgerId {
                        InfoRow(label: "Ledger", value: ledgerId)
                    }

                    if let confirmations = chainAnchor.confirmationCount {
                        InfoRow(label: "Confirmations", value: "\(confirmations)")
                    }
                }
            } else {
                Text("Chain anchor not confirmed")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
            Spacer()
            Text(value)
                .font(WalletTypography.caption)
                .foregroundColor(.walletText)
        }
    }
}

// MARK: - Task 38: Compliance Card

struct ComplianceCard: View {
    let compliance: ComplianceVerdicts

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            HStack {
                Image(systemName: "shield.checkered")
                    .foregroundColor(.walletPrimary)
                Text("Compliance Status")
                    .font(WalletTypography.headline)
                Spacer()
                if compliance.overallCompliant {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }

            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                ComplianceRow(label: "DEA Status", status: compliance.deaStatus)
                ComplianceRow(label: "Licensure", status: compliance.licensureStatus)
                ComplianceRow(label: "Sanctions", status: compliance.sanctionsStatus)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
    }
}

struct ComplianceRow: View {
    let label: String
    let status: String

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
            Spacer()
            StatusBadge(status: status)
        }
    }
}

struct StatusBadge: View {
    let status: String

    var body: some View {
        Text(status.capitalized)
            .font(WalletTypography.caption2)
            .foregroundColor(statusColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .cornerRadius(4)
    }

    private var statusColor: Color {
        switch status.lowercased() {
        case "active", "valid", "clear":
            return .green
        case "pending", "review":
            return .yellow
        default:
            return .red
        }
    }
}

// MARK: - Task 40: Share Proof View

struct ShareProofView: View {
    let result: VerificationResult
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.lg) {
                Text("Share Verification Proof")
                    .font(WalletTypography.title2)
                    .padding()

                // DPoP-bound proof URL and JWT
                VStack(alignment: .leading, spacing: WalletSpacing.md) {
                    Text("Proof URL:")
                        .font(WalletTypography.headline)

                    Text(generateProofURL())
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                        .padding()
                        .background(Color.walletCard)
                        .cornerRadius(WalletCornerRadius.medium)

                    Text("Proof JWT:")
                        .font(WalletTypography.headline)
                        .padding(.top)

                    Text(generateProofJWT())
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                        .padding()
                        .background(Color.walletCard)
                        .cornerRadius(WalletCornerRadius.medium)
                }
                .padding()

                Button("Share") {
                    // Share logic
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .padding()
            }
            .navigationTitle("Share Proof")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func generateProofURL() -> String {
        // Generate DPoP-bound proof URL
        return "https://verify.vitalcv.com/proof/\(result.credentialId)?dpop=\(UUID().uuidString)"
    }

    private func generateProofJWT() -> String {
        // Generate DPoP-bound proof JWT
        // In production, this would create an actual JWT with DPoP proof
        return "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVkZW50aWFsX2lkIjoi\(result.credentialId)..."
    }
}




