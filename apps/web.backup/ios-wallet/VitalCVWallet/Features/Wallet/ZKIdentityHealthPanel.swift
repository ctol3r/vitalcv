//
//  ZKIdentityHealthPanel.swift
//  VitalCVWallet
//
//  Created: Advanced Chain Anchoring & ZK-Proof Identity ARC - Phase 2
//  ZK Identity Health Panel showing proof completeness and hidden fields
//

import SwiftUI

/// ZKIdentityHealthPanel - Health panel for ZK identity
public struct ZKIdentityHealthPanel: View {
    @StateObject private var zkEngine = ZKIdentityEngine.shared
    let did: String
    @State private var health: ZKIdentityHealth?

    public init(did: String) {
        self.did = did
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Header
            HStack {
                Text("ZK Identity Health")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletTextPrimary)

                Spacer()

                if let health = health {
                    CommitmentStatusBadge(status: health.commitmentStatus)
                }
            }

            if let health = health {
                // Proof completeness
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    HStack {
                        Text("Proof Completeness")
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)

                        Spacer()

                        Text("\(Int(health.proofCompleteness * 100))%")
                            .font(WalletTypography.headline)
                            .foregroundColor(.walletPrimary)
                    }

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.walletTextSecondary.opacity(0.1))
                                .frame(height: 8)

                            RoundedRectangle(cornerRadius: 4)
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            Color.walletPrimary.opacity(0.6),
                                            Color.walletPrimary
                                        ],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(
                                    width: geometry.size.width * CGFloat(health.proofCompleteness),
                                    height: 8
                                )
                        }
                    }
                    .frame(height: 8)
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)

                // Hidden fields count
                HStack {
                    Image(systemName: "eye.slash.fill")
                        .foregroundColor(.walletPrimary)

                    Text("\(health.hiddenFieldsCount) hidden fields")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextPrimary)

                    Spacer()

                    if let lastProof = health.lastProofDate {
                        Text(formatDate(lastProof))
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding()
            }
        }
        .padding()
        .background(Color.walletCard.opacity(0.5))
        .cornerRadius(WalletCornerRadius.medium)
        .onAppear {
            loadHealth()
        }
    }

    private func loadHealth() {
        health = zkEngine.getIdentityHealth(did: did)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Commitment Status Badge

struct CommitmentStatusBadge: View {
    let status: CommitmentStatus

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            Text(statusLabel)
                .font(WalletTypography.caption2)
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .cornerRadius(4)
    }

    private var statusColor: Color {
        switch status {
        case .active:
            return .walletSuccess
        case .missing:
            return .walletError
        case .expired:
            return .walletWarning
        }
    }

    private var statusLabel: String {
        switch status {
        case .active:
            return "Active"
        case .missing:
            return "Missing"
        case .expired:
            return "Expired"
        }
    }
}








