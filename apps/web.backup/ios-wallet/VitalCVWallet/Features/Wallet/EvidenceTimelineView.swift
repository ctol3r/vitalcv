//
//  EvidenceTimelineView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 14
//  Tap-to-expand evidence timeline
//

import SwiftUI

struct EvidenceTimelineView: View {
    let evidence: [Evidence]
    @State private var expandedIndices: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            HStack {
                Text("Evidence Timeline")
                    .font(WalletTypography.title3)
                    .foregroundColor(.walletText)

                Spacer()

                Text("\(evidence.count) entries")
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
            }

            ForEach(Array(evidence.enumerated()), id: \.element.id) { index, item in
                EvidenceTimelineItem(
                    evidence: item,
                    isExpanded: expandedIndices.contains(index),
                    onTap: {
                        withAnimation(.spring(response: 0.3)) {
                            if expandedIndices.contains(index) {
                                expandedIndices.remove(index)
                            } else {
                                expandedIndices.insert(index)
                            }
                        }
                        HapticFeedback.play(.selection)
                    }
                )
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }
}

struct EvidenceTimelineItem: View {
    let evidence: Evidence
    let isExpanded: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onTap) {
                HStack(alignment: .top, spacing: WalletSpacing.md) {
                    // Timeline dot
                    VStack {
                        Circle()
                            .fill(Color.walletPrimary)
                            .frame(width: 12, height: 12)

                        if isExpanded {
                            Rectangle()
                                .fill(Color.walletPrimary.opacity(0.3))
                                .frame(width: 2)
                                .frame(maxHeight: .infinity)
                        }
                    }
                    .frame(width: 12)

                    // Content
                    VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                        HStack {
                            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                                Text(evidence.type)
                                    .font(WalletTypography.subheadline)
                                    .foregroundColor(.walletText)

                                Text(formatDate(evidence.timestamp))
                                    .font(WalletTypography.caption1)
                                    .foregroundColor(.walletTextSecondary)
                            }

                            Spacer()

                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .font(.system(size: 12))
                                .foregroundColor(.walletTextSecondary)
                        }

                        if isExpanded {
                            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                                if let description = evidence.description {
                                    Text(description)
                                        .font(WalletTypography.caption1)
                                        .foregroundColor(.walletText)
                                        .padding(WalletSpacing.sm)
                                        .background(Color.walletBackground)
                                        .cornerRadius(WalletCornerRadius.small)
                                }

                                HStack {
                                    Label(evidence.source, systemImage: "link")
                                        .font(WalletTypography.caption2)
                                        .foregroundColor(.walletTextSecondary)

                                    Spacer()
                                }
                            }
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }
                }
                .padding(WalletSpacing.sm)
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    EvidenceTimelineView(
        evidence: [
            Evidence(
                id: "1",
                type: "Document Verification",
                timestamp: Date().addingTimeInterval(-86400 * 2),
                source: "NPPES Registry",
                description: "License verified against state medical board database"
            ),
            Evidence(
                id: "2",
                type: "Identity Verification",
                timestamp: Date().addingTimeInterval(-86400),
                source: "Identity Provider",
                description: "Biometric verification completed successfully"
            )
        ]
    )
    .padding()
}

