//
//  ReusableCardBackground.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 9
//  Reusable card background component
//

import SwiftUI

/// ReusableCardBackground - Reusable card background with various styles
struct ReusableCardBackground: ViewModifier {
    var style: CardStyle
    var cornerRadius: CGFloat
    var padding: EdgeInsets

    enum CardStyle {
        case standard
        case elevated
        case outlined
        case glass
        case gradient(Gradient)
        case trust(TrustLevel)

        enum TrustLevel {
            case high
            case medium
            case low
        }
    }

    init(
        style: CardStyle = .standard,
        cornerRadius: CGFloat = WalletCornerRadius.medium,
        padding: EdgeInsets = EdgeInsets(
            top: WalletSpacing.md,
            leading: WalletSpacing.md,
            bottom: WalletSpacing.md,
            trailing: WalletSpacing.md
        )
    ) {
        self.style = style
        self.cornerRadius = cornerRadius
        self.padding = padding
    }

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(backgroundView)
            .cornerRadius(cornerRadius)
    }

    @ViewBuilder
    private var backgroundView: some View {
        switch style {
        case .standard:
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)

        case .elevated:
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.1), radius: 12, x: 0, y: 4)

        case .outlined:
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(Color.walletCard)
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(Color.walletTextSecondary.opacity(0.2), lineWidth: 1)
                )

        case .glass:
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )

        case .gradient(let gradient):
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        gradient: gradient,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)

        case .trust(let level):
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(trustColor(for: level).opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(trustColor(for: level).opacity(0.3), lineWidth: 2)
                )
                .shadow(color: trustColor(for: level).opacity(0.2), radius: 8, x: 0, y: 4)
        }
    }

    private func trustColor(for level: CardStyle.TrustLevel) -> Color {
        switch level {
        case .high: return .walletSuccess
        case .medium: return .walletWarning
        case .low: return .walletError
        }
    }
}

// MARK: - View Extension

extension View {
    /// Apply reusable card background
    func cardBackground(
        style: ReusableCardBackground.CardStyle = .standard,
        cornerRadius: CGFloat = WalletCornerRadius.medium,
        padding: EdgeInsets? = nil
    ) -> some View {
        modifier(ReusableCardBackground(
            style: style,
            cornerRadius: cornerRadius,
            padding: padding ?? EdgeInsets(
                top: WalletSpacing.md,
                leading: WalletSpacing.md,
                bottom: WalletSpacing.md,
                trailing: WalletSpacing.md
            )
        ))
    }
}

// MARK: - Preset Card Styles

extension ReusableCardBackground.CardStyle {
    /// Credential card style
    static var credential: ReusableCardBackground.CardStyle {
        .elevated
    }

    /// Trust card style with high trust
    static var trustHigh: ReusableCardBackground.CardStyle {
        .trust(.high)
    }

    /// Trust card style with medium trust
    static var trustMedium: ReusableCardBackground.CardStyle {
        .trust(.medium)
    }

    /// Trust card style with low trust
    static var trustLow: ReusableCardBackground.CardStyle {
        .trust(.low)
    }

    /// Primary gradient card
    static var primaryGradient: ReusableCardBackground.CardStyle {
        .gradient(
            Gradient(colors: [
                Color.walletPrimary,
                Color.walletSecondary
            ])
        )
    }
}








