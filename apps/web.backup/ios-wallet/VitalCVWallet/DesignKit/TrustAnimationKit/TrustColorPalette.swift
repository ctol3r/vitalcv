//
//  TrustColorPalette.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 7
//  Trust color palette (Emerald, Amber, Rose, Indigo)
//

import SwiftUI

/// TrustColorPalette - Semantic color system for trust states
struct TrustColorPalette {
    // MARK: - Emerald (Success/Verified)

    static let emerald50 = Color(red: 0.91, green: 0.99, blue: 0.96)
    static let emerald100 = Color(red: 0.81, green: 0.98, blue: 0.92)
    static let emerald200 = Color(red: 0.64, green: 0.95, blue: 0.85)
    static let emerald300 = Color(red: 0.40, green: 0.89, blue: 0.73)
    static let emerald400 = Color(red: 0.20, green: 0.80, blue: 0.58)
    static let emerald500 = Color(red: 0.16, green: 0.71, blue: 0.50) // Primary
    static let emerald600 = Color(red: 0.13, green: 0.59, blue: 0.42)
    static let emerald700 = Color(red: 0.11, green: 0.47, blue: 0.35)
    static let emerald800 = Color(red: 0.09, green: 0.38, blue: 0.29)
    static let emerald900 = Color(red: 0.07, green: 0.30, blue: 0.23)

    // MARK: - Amber (Warning/Uncertain)

    static let amber50 = Color(red: 1.00, green: 0.99, blue: 0.95)
    static let amber100 = Color(red: 1.00, green: 0.96, blue: 0.88)
    static let amber200 = Color(red: 0.99, green: 0.91, blue: 0.73)
    static let amber300 = Color(red: 0.98, green: 0.84, blue: 0.50)
    static let amber400 = Color(red: 0.96, green: 0.74, blue: 0.24)
    static let amber500 = Color(red: 0.92, green: 0.64, blue: 0.16) // Primary
    static let amber600 = Color(red: 0.84, green: 0.52, blue: 0.13)
    static let amber700 = Color(red: 0.69, green: 0.40, blue: 0.11)
    static let amber800 = Color(red: 0.56, green: 0.32, blue: 0.09)
    static let amber900 = Color(red: 0.45, green: 0.26, blue: 0.07)

    // MARK: - Rose (Failure/Rejected)

    static let rose50 = Color(red: 1.00, green: 0.97, blue: 0.97)
    static let rose100 = Color(red: 1.00, green: 0.94, blue: 0.93)
    static let rose200 = Color(red: 1.00, green: 0.88, blue: 0.86)
    static let rose300 = Color(red: 0.99, green: 0.76, blue: 0.73)
    static let rose400 = Color(red: 0.97, green: 0.60, blue: 0.57)
    static let rose500 = Color(red: 0.94, green: 0.42, blue: 0.38) // Primary
    static let rose600 = Color(red: 0.86, green: 0.31, blue: 0.27)
    static let rose700 = Color(red: 0.73, green: 0.25, blue: 0.22)
    static let rose800 = Color(red: 0.61, green: 0.21, blue: 0.19)
    static let rose900 = Color(red: 0.51, green: 0.18, blue: 0.16)

    // MARK: - Indigo (Information/Processing)

    static let indigo50 = Color(red: 0.95, green: 0.96, blue: 1.00)
    static let indigo100 = Color(red: 0.90, green: 0.92, blue: 0.99)
    static let indigo200 = Color(red: 0.81, green: 0.84, blue: 0.97)
    static let indigo300 = Color(red: 0.67, green: 0.71, blue: 0.93)
    static let indigo400 = Color(red: 0.52, green: 0.56, blue: 0.87)
    static let indigo500 = Color(red: 0.40, green: 0.44, blue: 0.79) // Primary
    static let indigo600 = Color(red: 0.34, green: 0.37, blue: 0.68)
    static let indigo700 = Color(red: 0.28, green: 0.31, blue: 0.57)
    static let indigo800 = Color(red: 0.23, green: 0.26, blue: 0.47)
    static let indigo900 = Color(red: 0.19, green: 0.21, blue: 0.38)

    // MARK: - Semantic Mappings

    static func color(for state: TrustState, intensity: Double = 0.5) -> Color {
        switch state {
        case .idle:
            return indigo(intensity: intensity)
        case .verifying:
            return indigo(intensity: intensity)
        case .passed:
            return emerald(intensity: intensity)
        case .warning:
            return amber(intensity: intensity)
        case .failed:
            return rose(intensity: intensity)
        }
    }

    static func emerald(intensity: Double) -> Color {
        let normalized = max(0.0, min(1.0, intensity))
        if normalized < 0.5 {
            return emerald300
        } else if normalized < 0.7 {
            return emerald500
        } else {
            return emerald700
        }
    }

    static func amber(intensity: Double) -> Color {
        let normalized = max(0.0, min(1.0, intensity))
        if normalized < 0.5 {
            return amber300
        } else if normalized < 0.7 {
            return amber500
        } else {
            return amber700
        }
    }

    static func rose(intensity: Double) -> Color {
        let normalized = max(0.0, min(1.0, intensity))
        if normalized < 0.5 {
            return rose300
        } else if normalized < 0.7 {
            return rose500
        } else {
            return rose700
        }
    }

    static func indigo(intensity: Double) -> Color {
        let normalized = max(0.0, min(1.0, intensity))
        if normalized < 0.5 {
            return indigo300
        } else if normalized < 0.7 {
            return indigo500
        } else {
            return indigo700
        }
    }
}

extension Color {
    static let trustEmerald = TrustColorPalette.emerald500
    static let trustAmber = TrustColorPalette.amber500
    static let trustRose = TrustColorPalette.rose500
    static let trustIndigo = TrustColorPalette.indigo500
}

