//
//  ChainDetailSheetView.swift
//  VitalCVWallet
//
//  Created: Phase 3 - Task 17
//  Chain detail sheet (the sheet users open when they want the raw truth)
//

import SwiftUI

/// ChainDetailSheetView - Detailed blockchain information sheet
struct ChainDetailSheetView: View {
    let anchor: ChainAnchor
    @Environment(\.dismiss) var dismiss
    @State private var showComparison = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    // Header with block progress ring (Task 22)
                    VStack(spacing: WalletSpacing.md) {
                        BlockProgressRing(
                            confirmations: anchor.confirmations,
                            maxConfirmations: 12
                        )

                        Text("Chain Anchor Details")
                            .font(WalletTypography.title2)
                            .foregroundColor(.walletTextPrimary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, WalletSpacing.lg)

                    // Block number (Task 18)
                    DetailSection(title: "Block Information") {
                        DetailRow(label: "Block Number", value: "\(anchor.blockNumber)")

                        if let ledgerId = anchor.ledgerId {
                            DetailRow(label: "Ledger ID", value: ledgerId)
                        }
                    }

                    // Transaction hash (Task 18, 20)
                    DetailSection(title: "Transaction") {
                        DetailRow(
                            label: "Transaction Hash",
                            value: truncatedHash(anchor.transactionHash)
                        )

                        // Cryptographic hash preview (Task 20)
                        HStack {
                            Text("Hash Preview:")
                                .font(WalletTypography.caption)
                                .foregroundColor(.walletTextSecondary)

                            Text(hashPreview(anchor.transactionHash))
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.chainEmerald)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(
                                    Capsule()
                                        .fill(ChainColorPalette.emerald.opacity(0.1))
                                )
                        }
                    }

                    // Timestamp (Task 18)
                    DetailSection(title: "Timing") {
                        DetailRow(
                            label: "Local Time",
                            value: localTimestamp
                        )

                        DetailRow(
                            label: "UTC Time",
                            value: utcTimestamp
                        )

                        DetailRow(
                            label: "Age",
                            value: "\(anchor.daysSinceAnchor) days ago"
                        )
                    }

                    // Trust reasoning (Task 23)
                    TrustReasoningView(anchor: anchor)

                    // Trust caveats (Task 24)
                    if anchor.isStale {
                        TrustCaveatsView(anchor: anchor)
                    }

                    // View in Explorer (Task 19)
                    if let explorerUrl = anchor.explorerUrl {
                        Button(action: {
                            if let url = URL(string: explorerUrl) {
                                UIApplication.shared.open(url)
                            }
                        }) {
                            HStack {
                                Image(systemName: "arrow.up.right.square")
                                Text("View in Explorer")
                            }
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(ChainColorPalette.emerald)
                            .cornerRadius(WalletCornerRadius.medium)
                        }
                    }

                    // Comparison tool (Task 21)
                    if showComparison {
                        AnchorComparisonView(anchor: anchor)
                    } else {
                        Button(action: {
                            withAnimation {
                                showComparison = true
                            }
                        }) {
                            HStack {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                Text("Compare with Previous Anchor")
                            }
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.chainEmerald)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                    .stroke(ChainColorPalette.emerald, lineWidth: 1)
                            )
                        }
                    }
                }
                .padding(WalletSpacing.md)
            }
            .navigationTitle("Chain Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func truncatedHash(_ hash: String) -> String {
        if hash.count > 16 {
            return String(hash.prefix(8)) + "..." + String(hash.suffix(8))
        }
        return hash
    }

    private func hashPreview(_ hash: String) -> String {
        String(hash.prefix(8))
    }

    private var localTimestamp: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.timeZone = TimeZone.current
        return formatter.string(from: anchor.timestamp)
    }

    private var utcTimestamp: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: anchor.timestamp)
    }
}

/// DetailSection - Section container
struct DetailSection<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text(title)
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextPrimary)

            VStack(spacing: WalletSpacing.sm) {
                content
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
        }
    }
}

/// BlockProgressRing - Animated block progress ring (Task 22)
struct BlockProgressRing: View {
    let confirmations: Int
    let maxConfirmations: Int

    @State private var animatedProgress: Double = 0

    var body: some View {
        ZStack {
            // Background circle
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 12)
                .frame(width: 120, height: 120)

            // Progress circle
            Circle()
                .trim(from: 0, to: animatedProgress)
                .stroke(
                    progressColor,
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
                .frame(width: 120, height: 120)
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.8, dampingFraction: 0.7), value: animatedProgress)

            // Center content
            VStack(spacing: 4) {
                Text("\(confirmations)")
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(progressColor)

                Text("Confirmations")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .onAppear {
            animatedProgress = Double(confirmations) / Double(maxConfirmations)
        }
        .onChange(of: confirmations) { newValue in
            withAnimation {
                animatedProgress = Double(newValue) / Double(maxConfirmations)
            }
        }
    }

    private var progressColor: Color {
        if confirmations >= 12 {
            return ChainColorPalette.emerald
        } else if confirmations >= 6 {
            return ChainColorPalette.emerald.opacity(0.8)
        } else if confirmations >= 3 {
            return ChainColorPalette.amber
        } else {
            return ChainColorPalette.glacialBlue
        }
    }
}

/// TrustReasoningView - Trust reasoning explanation (Task 23)
struct TrustReasoningView: View {
    let anchor: ChainAnchor

    var body: some View {
        DetailSection(title: "Why This Anchor is Trusted") {
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                TrustReasonRow(
                    icon: "checkmark.seal.fill",
                    title: "Blockchain Immutability",
                    description: "Once anchored, this credential cannot be altered without detection."
                )

                TrustReasonRow(
                    icon: "link.circle.fill",
                    title: "\(anchor.confirmations) Confirmations",
                    description: "Multiple block confirmations ensure transaction finality."
                )

                if anchor.confirmations >= 12 {
                    TrustReasonRow(
                        icon: "star.fill",
                        title: "Maximum Confidence",
                        description: "12+ confirmations provide the highest level of trust."
                    )
                }
            }
        }
    }
}

struct TrustReasonRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: WalletSpacing.sm) {
            Image(systemName: icon)
                .foregroundColor(.chainEmerald)
                .font(.system(size: 20))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextPrimary)

                Text(description)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
    }
}

/// TrustCaveatsView - Trust caveats and warnings (Task 24)
struct TrustCaveatsView: View {
    let anchor: ChainAnchor

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(ChainColorPalette.amber)

                Text("Trust Caveats")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletTextPrimary)
            }

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text("⚠️ Anchor is stale. Re-verification recommended.")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(ChainColorPalette.amber)

                Text("This anchor is \(anchor.daysSinceAnchor) days old. While the blockchain record is immutable, the credential itself may have been updated or revoked. Consider re-verifying the credential status.")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(ChainColorPalette.amber.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .stroke(ChainColorPalette.amber.opacity(0.3), lineWidth: 1)
                    )
            )
        }
    }
}

/// AnchorComparisonView - Comparison tool for re-anchored versions (Task 21)
struct AnchorComparisonView: View {
    let anchor: ChainAnchor
    // In a real implementation, this would fetch previous anchors
    // For now, we'll show a placeholder structure

    var body: some View {
        DetailSection(title: "Anchor Comparison") {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                Text("Current Anchor")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextPrimary)

                AnchorComparisonRow(
                    label: "Block Number",
                    current: "\(anchor.blockNumber)",
                    previous: "12,345,670" // Placeholder
                )

                AnchorComparisonRow(
                    label: "Confirmations",
                    current: "\(anchor.confirmations)",
                    previous: "12"
                )

                AnchorComparisonRow(
                    label: "Age",
                    current: "\(anchor.daysSinceAnchor) days",
                    previous: "120 days"
                )
            }
        }
    }
}

struct AnchorComparisonRow: View {
    let label: String
    let current: String
    let previous: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)

            HStack {
                VStack(alignment: .leading) {
                    Text("Current")
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletTextSecondary)
                    Text(current)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.chainEmerald)
                }

                Spacer()

                Image(systemName: "arrow.right")
                    .foregroundColor(.walletTextSecondary)

                Spacer()

                VStack(alignment: .trailing) {
                    Text("Previous")
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletTextSecondary)
                    Text(previous)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }
            }
        }
        .padding()
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.small)
    }
}

// MARK: - Preview

#Preview {
    ChainDetailSheetView(
        anchor: ChainAnchor(
            credentialId: "cred-123",
            blockNumber: 12345678,
            transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            timestamp: Date().addingTimeInterval(-86400 * 5),
            confirmations: 8,
            status: .anchored,
            ledgerId: "ledger-123",
            explorerUrl: "https://explorer.example.com/tx/0x123"
        )
    )
}








