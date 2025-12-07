//
//  ClipTheme.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 1
//  Shared theme for App Clip (compatible with main app)
//

import SwiftUI

// MARK: - Colors (matching main app)

extension Color {
    static let walletPrimary = Color(red: 0.2, green: 0.4, blue: 0.8)
    static let walletSecondary = Color(red: 0.3, green: 0.6, blue: 0.9)
    static let walletBackground = Color(red: 0.98, green: 0.98, blue: 0.99)
    static let walletCardBackground = Color.white
    static let walletTextPrimary = Color(red: 0.1, green: 0.1, blue: 0.1)
    static let walletTextSecondary = Color(red: 0.5, green: 0.5, blue: 0.5)
}

// MARK: - Typography (matching main app)

struct WalletTypography {
    static let largeTitle = Font.system(size: 34, weight: .bold, design: .default)
    static let title = Font.system(size: 28, weight: .bold, design: .default)
    static let title2 = Font.system(size: 22, weight: .semibold, design: .default)
    static let title3 = Font.system(size: 20, weight: .semibold, design: .default)
    static let headline = Font.system(size: 17, weight: .semibold, design: .default)
    static let body = Font.system(size: 17, weight: .regular, design: .default)
    static let subheadline = Font.system(size: 15, weight: .regular, design: .default)
    static let caption = Font.system(size: 12, weight: .regular, design: .default)
    static let caption2 = Font.system(size: 11, weight: .regular, design: .default)
}

// MARK: - Spacing

struct WalletSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
}

// MARK: - Corner Radius

struct WalletCornerRadius {
    static let small: CGFloat = 8
    static let medium: CGFloat = 12
    static let large: CGFloat = 16
    static let xlarge: CGFloat = 24
}




