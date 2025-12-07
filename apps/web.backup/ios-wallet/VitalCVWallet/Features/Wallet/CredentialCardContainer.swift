//
//  CredentialCardContainer.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 9
//  Credential card container with layered glass effect
//

import SwiftUI

/// CredentialCardContainer - Card with glass effect and trust glow
struct CredentialCardContainer: View {
    let item: CredentialListItem
    let onTap: () -> Void

    // Task 18: Long-press context menu
    @State private var showingContextMenu = false

    var body: some View {
        Button(action: {
            HapticFeedbackService.shared.cardTapped()
            onTap()
        }) {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                // Header with icon and issuer logo
                HStack {
                    // Task 11: Credential icon by type
                    Image(systemName: item.iconName)
                        .font(.system(size: 24))
                        .foregroundColor(Color(item.primaryColor))

                    Spacer()

                    // Task 12: Issuer logo on top-right badge (Task 25: Cached)
                    if let logoURL = item.issuerLogoURL, let url = URL(string: logoURL) {
                        CachedAsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        } placeholder: {
                            Circle()
                                .fill(Color.walletCard)
                        }
                        .frame(width: 32, height: 32)
                        .clipShape(Circle())
                    }
                }

                // Title and subtitle
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(item.title)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)
                        .lineLimit(2)

                    Text(item.issuerName)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                        .lineLimit(1)
                }

                // Task 13: Expiration countdown bar
                if let expirationDate = item.expirationDate {
                    ExpirationCountdownBar(
                        expirationDate: expirationDate,
                        isExpired: item.isExpired,
                        isExpiringSoon: item.isExpiringSoon
                    )
                }

                // Task 14: Compliance badges
                if !item.complianceBadges.isEmpty {
                    ComplianceBadgesRow(badges: item.complianceBadges)
                }

                // Footer with anchor status and trust score
                HStack {
                    // Task 15: Anchor status indicator dot
                    AnchorStatusDot(status: item.anchorStatus)

                    Spacer()

                    // Task 16: Trust score mini-ring
                    if let trustScore = item.trustScore {
                        TrustScoreMiniRing(score: trustScore)
                    }
                }
            }
            .padding(WalletSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Task 9: Layered glass effect
            .glassEffect()
            // Task 10: Trust-glow modifier
            .trustGlow(trustScore: item.trustScore)
        }
        .buttonStyle(PlainButtonStyle())
        // Task 18: Long-press context menu (Share / Verify / Copy DID)
        .contextMenu {
            Button(action: {
                shareCredential()
            }) {
                Label("Share", systemImage: "square.and.arrow.up")
            }

            Button(action: {
                verifyCredential()
            }) {
                Label("Verify", systemImage: "checkmark.shield")
            }

            Button(action: {
                copyDID()
            }) {
                Label("Copy DID", systemImage: "doc.on.doc")
            }
        }
    }

    // MARK: - Context Menu Actions

    private func shareCredential() {
        // TODO: Implement credential sharing
        HapticFeedbackService.shared.selectionChanged()
    }

    private func verifyCredential() {
        // TODO: Navigate to verification
        HapticFeedbackService.shared.selectionChanged()
    }

    private func copyDID() {
        // Copy credential subject DID to clipboard
        UIPasteboard.general.string = item.credential.credentialSubject.id
        HapticFeedbackService.shared.success()
    }
}

// MARK: - Supporting Views

struct ExpirationCountdownBar: View {
    let expirationDate: Date
    let isExpired: Bool
    let isExpiringSoon: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            HStack {
                Text(isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Valid")
                    .font(WalletTypography.caption1)
                    .foregroundColor(barColor)

                Spacer()

                if !isExpired {
                    Text(daysRemaining)
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.walletCard)
                        .frame(height: 4)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(barColor)
                        .frame(width: progressWidth(in: geometry.size.width), height: 4)
                }
            }
            .frame(height: 4)
        }
    }

    private var barColor: Color {
        if isExpired {
            return .walletError
        } else if isExpiringSoon {
            return .walletWarning
        } else {
            return .walletSuccess
        }
    }

    private var daysRemaining: String {
        let days = Calendar.current.dateComponents([.day], from: Date(), to: expirationDate).day ?? 0
        if days > 0 {
            return "\(days) days"
        } else {
            return "Today"
        }
    }

    private func progressWidth(in totalWidth: CGFloat) -> CGFloat {
        guard !isExpired else { return 0 }

        let days = Calendar.current.dateComponents([.day], from: Date(), to: expirationDate).day ?? 0
        let totalDays = Calendar.current.dateComponents([.day], from: Date().addingTimeInterval(-365 * 24 * 60 * 60), to: expirationDate).day ?? 365

        let progress = max(0, min(1, Double(days) / Double(totalDays)))
        return totalWidth * CGFloat(progress)
    }
}

struct ComplianceBadgesRow: View {
    let badges: [CredentialListItem.ComplianceBadge]

    var body: some View {
        HStack(spacing: WalletSpacing.xs) {
            ForEach(badges, id: \.type) { badge in
                HStack(spacing: 4) {
                    Image(systemName: badge.verified ? "checkmark.seal.fill" : "seal")
                        .font(.system(size: 10))
                    Text(badge.type.rawValue)
                        .font(WalletTypography.caption2)
                }
                .foregroundColor(badge.verified ? .walletSuccess : .walletTextSecondary)
                .padding(.horizontal, WalletSpacing.xs)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(badge.verified ? Color.walletSuccess.opacity(0.1) : Color.walletCard)
                )
            }
        }
    }
}

struct AnchorStatusDot: View {
    let status: CredentialListItem.AnchorStatus

    var body: some View {
        HStack(spacing: WalletSpacing.xs) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            Text(statusText)
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
        }
    }

    private var statusColor: Color {
        switch status {
        case .anchored: return .walletSuccess
        case .pending: return .walletWarning
        case .failed: return .walletError
        case .unknown: return .walletTextSecondary
        }
    }

    private var statusText: String {
        switch status {
        case .anchored: return "Anchored"
        case .pending: return "Pending"
        case .failed: return "Failed"
        case .unknown: return "Unknown"
        }
    }
}

struct TrustScoreMiniRing: View {
    let score: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.walletCard, lineWidth: 3)
                .frame(width: 24, height: 24)

            Circle()
                .trim(from: 0, to: score)
                .stroke(scoreColor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .frame(width: 24, height: 24)
                .rotationEffect(.degrees(-90))
        }
    }

    private var scoreColor: Color {
        if score >= 0.8 {
            return .walletSuccess
        } else if score >= 0.6 {
            return .walletWarning
        } else {
            return .walletError
        }
    }
}

struct CredentialGroupSection: View {
    let category: CredentialCategory
    let items: [CredentialListItem]
    let onTap: (CredentialListItem) -> Void
    let onQuickVerify: (CredentialListItem) -> Void
    let onRenew: (CredentialListItem) -> Void
    let onUpdate: (CredentialListItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            HStack {
                Image(systemName: category.icon)
                    .foregroundColor(category.color)
                Text(category.rawValue)
                    .font(WalletTypography.title3)
                    .foregroundColor(.walletText)
                Spacer()
                Text("\(items.count)")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
            }

            ForEach(items) { item in
                // Task 19-20: Use swipeable card for swipe actions
                SwipeableCredentialCard(
                    item: item,
                    onTap: { onTap(item) },
                    onQuickVerify: { onQuickVerify(item) },
                    onRenew: { onRenew(item) },
                    onUpdate: { onUpdate(item) }
                )
            }
        }
    }
}

