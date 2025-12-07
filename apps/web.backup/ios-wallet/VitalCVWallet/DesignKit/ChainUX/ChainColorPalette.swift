//
//  ChainColorPalette.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 3
//  Chain color palette (glacial blue → emerald → amber → red)
//

import SwiftUI

/// ChainColorPalette - Semantic color system for blockchain states
public struct ChainColorPalette {
    // MARK: - Glacial Blue (Confirming/Processing)

    public static let glacialBlue50 = Color(red: 0.95, green: 0.97, blue: 1.00)
    public static let glacialBlue100 = Color(red: 0.88, green: 0.94, blue: 1.00)
    public static let glacialBlue200 = Color(red: 0.76, green: 0.88, blue: 0.99)
    public static let glacialBlue300 = Color(red: 0.60, green: 0.80, blue: 0.97)
    public static let glacialBlue400 = Color(red: 0.45, green: 0.72, blue: 0.95)
    public static let glacialBlue500 = Color(red: 0.30, green: 0.64, blue: 0.93) // Primary
    public static let glacialBlue600 = Color(red: 0.25, green: 0.55, blue: 0.80)
    public static let glacialBlue700 = Color(red: 0.20, green: 0.45, blue: 0.67)
    public static let glacialBlue800 = Color(red: 0.16, green: 0.36, blue: 0.54)
    public static let glacialBlue900 = Color(red: 0.12, green: 0.28, blue: 0.42)

    // MARK: - Emerald (Anchored/Success)

    public static let emerald50 = Color(red: 0.91, green: 0.99, blue: 0.96)
    public static let emerald100 = Color(red: 0.81, green: 0.98, blue: 0.92)
    public static let emerald200 = Color(red: 0.64, green: 0.95, blue: 0.85)
    public static let emerald300 = Color(red: 0.40, green: 0.89, blue: 0.73)
    public static let emerald400 = Color(red: 0.20, green: 0.80, blue: 0.58)
    public static let emerald500 = Color(red: 0.16, green: 0.71, blue: 0.50) // Primary
    public static let emerald600 = Color(red: 0.13, green: 0.59, blue: 0.42)
    public static let emerald700 = Color(red: 0.11, green: 0.47, blue: 0.35)
    public static let emerald800 = Color(red: 0.09, green: 0.38, blue: 0.29)
    public static let emerald900 = Color(red: 0.07, green: 0.30, blue: 0.23)

    // MARK: - Amber (Stale/Warning)

    public static let amber50 = Color(red: 1.00, green: 0.99, blue: 0.95)
    public static let amber100 = Color(red: 1.00, green: 0.96, blue: 0.88)
    public static let amber200 = Color(red: 0.99, green: 0.91, blue: 0.73)
    public static let amber300 = Color(red: 0.98, green: 0.84, blue: 0.50)
    public static let amber400 = Color(red: 0.96, green: 0.74, blue: 0.24)
    public static let amber500 = Color(red: 0.92, green: 0.64, blue: 0.16) // Primary
    public static let amber600 = Color(red: 0.84, green: 0.52, blue: 0.13)
    public static let amber700 = Color(red: 0.69, green: 0.40, blue: 0.11)
    public static let amber800 = Color(red: 0.56, green: 0.32, blue: 0.09)
    public static let amber900 = Color(red: 0.45, green: 0.26, blue: 0.07)

    // MARK: - Red (Rejected/Failure)

    public static let red50 = Color(red: 1.00, green: 0.97, blue: 0.97)
    public static let red100 = Color(red: 1.00, green: 0.94, blue: 0.93)
    public static let red200 = Color(red: 1.00, green: 0.88, blue: 0.86)
    public static let red300 = Color(red: 0.99, green: 0.76, blue: 0.73)
    public static let red400 = Color(red: 0.97, green: 0.60, blue: 0.57)
    public static let red500 = Color(red: 0.94, green: 0.42, blue: 0.38) // Primary
    public static let red600 = Color(red: 0.86, green: 0.31, blue: 0.27)
    public static let red700 = Color(red: 0.73, green: 0.25, blue: 0.22)
    public static let red800 = Color(red: 0.61, green: 0.21, blue: 0.19)
    public static let red900 = Color(red: 0.51, green: 0.18, blue: 0.16)

    // MARK: - Semantic Accessors

    public static var glacialBlue: Color { glacialBlue500 }
    public static var emerald: Color { emerald500 }
    public static var amber: Color { amber500 }
    public static var red: Color { red500 }

    /// Get color for chain status
    public static func color(for status: ChainStatus) -> Color {
        switch status {
        case .confirming:
            return glacialBlue
        case .anchored:
            return emerald
        case .stale:
            return amber
        case .unverified:
            return glacialBlue.opacity(0.5)
        case .rejected:
            return red
        }
    }

    /// Get gradient for chain status
    public static func gradient(for status: ChainStatus) -> LinearGradient {
        switch status {
        case .confirming:
            return LinearGradient(
                colors: [glacialBlue400, glacialBlue600],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .anchored:
            return LinearGradient(
                colors: [emerald400, emerald600],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .stale:
            return LinearGradient(
                colors: [amber400, amber600],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .unverified:
            return LinearGradient(
                colors: [glacialBlue300.opacity(0.5), glacialBlue500.opacity(0.5)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .rejected:
            return LinearGradient(
                colors: [red400, red600],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

// MARK: - Color Extensions

extension Color {
    public static let chainGlacialBlue = ChainColorPalette.glacialBlue
    public static let chainEmerald = ChainColorPalette.emerald
    public static let chainAmber = ChainColorPalette.amber
    public static let chainRed = ChainColorPalette.red
}








