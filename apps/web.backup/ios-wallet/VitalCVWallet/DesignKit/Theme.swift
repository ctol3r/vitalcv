//
//  Theme.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 2
//  Design system and theme
//

import SwiftUI

// MARK: - Colors

extension Color {
    static let walletPrimary = Color(red: 0.2, green: 0.4, blue: 0.8)
    static let walletSecondary = Color(red: 0.3, green: 0.6, blue: 0.9)
    static let walletAccent = Color(red: 0.9, green: 0.4, blue: 0.2)
    static let walletBackground = Color(red: 0.98, green: 0.98, blue: 0.99)
    static let walletCard = Color.white
    static let walletText = Color(red: 0.1, green: 0.1, blue: 0.1)
    static let walletTextPrimary = Color(red: 0.1, green: 0.1, blue: 0.1)
    static let walletTextSecondary = Color(red: 0.5, green: 0.5, blue: 0.5)

    // Status colors
    static let walletSuccess = Color(red: 0.2, green: 0.7, blue: 0.3)
    static let walletWarning = Color(red: 0.9, green: 0.6, blue: 0.1)
    static let walletError = Color(red: 0.9, green: 0.2, blue: 0.2)
    static let walletInfo = Color(red: 0.2, green: 0.6, blue: 0.9)
}

// MARK: - Typography

struct WalletTypography {
    static let largeTitle = Font.system(size: 34, weight: .bold, design: .default)
    static let title1 = Font.system(size: 28, weight: .bold, design: .default)
    static let title2 = Font.system(size: 22, weight: .semibold, design: .default)
    static let title3 = Font.system(size: 20, weight: .semibold, design: .default)
    static let headline = Font.system(size: 17, weight: .semibold, design: .default)
    static let body = Font.system(size: 17, weight: .regular, design: .default)
    static let callout = Font.system(size: 16, weight: .regular, design: .default)
    static let subheadline = Font.system(size: 15, weight: .regular, design: .default)
    static let footnote = Font.system(size: 13, weight: .regular, design: .default)
    static let caption = Font.system(size: 12, weight: .regular, design: .default)
    static let caption1 = Font.system(size: 12, weight: .regular, design: .default)
    static let caption2 = Font.system(size: 11, weight: .regular, design: .default)
}

// MARK: - Spacing

struct WalletSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Corner Radius

struct WalletCornerRadius {
    static let small: CGFloat = 8
    static let medium: CGFloat = 12
    static let large: CGFloat = 16
    static let xlarge: CGFloat = 24
}

// MARK: - Shadows

struct WalletShadow {
    static let small = Shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    static let medium = Shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 2)
    static let large = Shadow(color: .black.opacity(0.2), radius: 16, x: 0, y: 4)

    // Enhanced shadows for trust levels (Task 35)
    static let trustHigh = Shadow(color: .green.opacity(0.3), radius: 20, x: 0, y: 4)
    static let trustMedium = Shadow(color: .yellow.opacity(0.2), radius: 12, x: 0, y: 3)
    static let trustLow = Shadow(color: .red.opacity(0.2), radius: 8, x: 0, y: 2)
}

struct Shadow {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

extension View {
    func walletShadow(_ shadow: Shadow) -> some View {
        self.shadow(color: shadow.color, radius: shadow.radius, x: shadow.x, y: shadow.y)
    }

    // Glass blur effect (Task 31)
    func glassBlur(style: UIBlurEffect.Style = .systemMaterial) -> some View {
        self.background(
            BlurView(style: style)
        )
    }
}

// MARK: - Glass Blur View (UIKit bridging for Task 31)

struct BlurView: UIViewRepresentable {
    let style: UIBlurEffect.Style

    func makeUIView(context: Context) -> UIVisualEffectView {
        UIVisualEffectView(effect: UIBlurEffect(style: style))
    }

    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {
        uiView.effect = UIBlurEffect(style: style)
    }
}

// MARK: - Gradient Trust Levels (Task 35)

extension Color {
    static let trustHighGradientStart = Color(red: 0.2, green: 0.8, blue: 0.4)
    static let trustHighGradientEnd = Color(red: 0.1, green: 0.6, blue: 0.3)

    static let trustMediumGradientStart = Color(red: 0.9, green: 0.7, blue: 0.2)
    static let trustMediumGradientEnd = Color(red: 0.8, green: 0.5, blue: 0.1)

    static let trustLowGradientStart = Color(red: 0.9, green: 0.3, blue: 0.3)
    static let trustLowGradientEnd = Color(red: 0.7, green: 0.2, blue: 0.2)
}

struct TrustGradient: View {
    let level: TrustLevel

    enum TrustLevel {
        case high, medium, low

        var colors: (start: Color, end: Color) {
            switch self {
            case .high:
                return (.trustHighGradientStart, .trustHighGradientEnd)
            case .medium:
                return (.trustMediumGradientStart, .trustMediumGradientEnd)
            case .low:
                return (.trustLowGradientStart, .trustLowGradientEnd)
            }
        }
    }

    var body: some View {
        LinearGradient(
            colors: [level.colors.start, level.colors.end],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

