//
//  ChainEventIconographySet.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 8
//  Chain event iconography set (anchor, re-anchor, revoke, stale)
//

import SwiftUI

/// ChainEventIconographySet - Iconography for chain events
public struct ChainEventIconographySet {
    // MARK: - Icons

    /// Anchor icon (first-time anchoring)
    public static var anchor: String { "anchor.fill" }

    /// Re-anchor icon (re-anchoring existing credential)
    public static var reAnchor: String { "arrow.clockwise.circle.fill" }

    /// Revoke icon (revocation event)
    public static var revoke: String { "xmark.circle.fill" }

    /// Stale icon (stale anchor warning)
    public static var stale: String { "exclamationmark.triangle.fill" }

    /// Confirming icon (pending confirmation)
    public static var confirming: String { "hourglass" }

    /// Verified icon (fully verified)
    public static var verified: String { "checkmark.seal.fill" }

    /// Unverified icon (unverified status)
    public static var unverified: String { "questionmark.circle.fill" }

    // MARK: - Icon Views

    /// Get icon view for chain event type
    public static func iconView(
        for eventType: ChainEventType,
        size: CGFloat = 24,
        color: Color? = nil
    ) -> some View {
        let iconName = icon(for: eventType)
        let iconColor = color ?? color(for: eventType)

        return Image(systemName: iconName)
            .font(.system(size: size))
            .foregroundColor(iconColor)
    }

    /// Get icon name for chain event type
    public static func icon(for eventType: ChainEventType) -> String {
        switch eventType {
        case .anchor:
            return anchor
        case .reAnchor:
            return reAnchor
        case .revoke:
            return revoke
        case .stale:
            return stale
        case .confirming:
            return confirming
        case .verified:
            return verified
        case .unverified:
            return unverified
        }
    }

    /// Get color for chain event type
    public static func color(for eventType: ChainEventType) -> Color {
        switch eventType {
        case .anchor, .reAnchor, .verified:
            return ChainColorPalette.emerald
        case .stale, .confirming:
            return ChainColorPalette.amber
        case .revoke:
            return ChainColorPalette.red
        case .unverified:
            return ChainColorPalette.glacialBlue.opacity(0.5)
        }
    }

    /// Get animated icon view with pulse
    public static func animatedIconView(
        for eventType: ChainEventType,
        size: CGFloat = 24,
        isAnimating: Bool = false
    ) -> some View {
        iconView(for: eventType, size: size)
            .scaleEffect(isAnimating ? 1.1 : 1.0)
            .animation(
                isAnimating ? Animation.easeInOut(duration: 1.0).repeatForever(autoreverses: true) : .default,
                value: isAnimating
            )
    }
}

/// Chain event type enumeration
public enum ChainEventType {
    case anchor      // First-time anchor
    case reAnchor    // Re-anchor existing
    case revoke      // Revocation
    case stale       // Stale anchor
    case confirming  // Pending confirmation
    case verified    // Fully verified
    case unverified  // Unverified status
}

// MARK: - Chain Event Badge

/// ChainEventBadge - Badge showing chain event with icon
struct ChainEventBadge: View {
    let eventType: ChainEventType
    let label: String?

    init(eventType: ChainEventType, label: String? = nil) {
        self.eventType = eventType
        self.label = label ?? defaultLabel(for: eventType)
    }

    var body: some View {
        HStack(spacing: 6) {
            ChainEventIconographySet.iconView(for: eventType, size: 14)

            if let label = label {
                Text(label)
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextPrimary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(ChainEventIconographySet.color(for: eventType).opacity(0.1))
                .overlay(
                    Capsule()
                        .stroke(ChainEventIconographySet.color(for: eventType).opacity(0.3), lineWidth: 1)
                )
        )
    }

    private static func defaultLabel(for eventType: ChainEventType) -> String? {
        switch eventType {
        case .anchor:
            return "Anchored"
        case .reAnchor:
            return "Re-anchored"
        case .revoke:
            return "Revoked"
        case .stale:
            return "Stale"
        case .confirming:
            return "Confirming"
        case .verified:
            return "Verified"
        case .unverified:
            return "Unverified"
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        ChainEventBadge(eventType: .anchor)
        ChainEventBadge(eventType: .reAnchor)
        ChainEventBadge(eventType: .revoke)
        ChainEventBadge(eventType: .stale)
        ChainEventBadge(eventType: .confirming)
        ChainEventBadge(eventType: .verified)
    }
    .padding()
}








