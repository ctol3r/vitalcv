// LumenColors.swift

// Light & trust mapping utilities

import SwiftUI

enum LumenPalette {
    static let vitalEmerald   = Color(#colorLiteral(red: 0.1, green: 0.8, blue: 0.5, alpha: 1))
    static let anchorBlue     = Color(#colorLiteral(red: 0.2, green: 0.5, blue: 1.0, alpha: 1))
    static let riskAmber      = Color(#colorLiteral(red: 0.95, green: 0.7, blue: 0.2, alpha: 1))
    static let criticalRed    = Color(#colorLiteral(red: 0.9, green: 0.15, blue: 0.25, alpha: 1))
    static let growthCyan     = Color(#colorLiteral(red: 0.0, green: 0.8, blue: 0.8, alpha: 1))
    static let veilPurple     = Color(#colorLiteral(red: 0.5, green: 0.3, blue: 0.8, alpha: 1))
    static let starlightWhite = Color.white.opacity(0.92)
}

extension Color {
    /// Maps a trust value 0...1 into a color gradient
    static func lumenTrustColor(trust: Double) -> Color {
        let t = max(0, min(1, trust))
        // Simple two-stop gradient: riskAmber → vitalEmerald
        return Color(
            red:   Double(0.95 - 0.85 * t),
            green: Double(0.7  + 0.1  * t),
            blue:  Double(0.2  + 0.3  * t)
        )
    }

    /// Maps a compliance value 0...1 into a sky-like tone
    static func lumenComplianceSky(compliance: Double) -> LinearGradient {
        let c = max(0, min(1, compliance))
        let top      = Color.blue.opacity(0.4 + 0.4 * c)
        let bottom   = Color.black.opacity(0.9 - 0.6 * c)
        return LinearGradient(colors: [top, bottom],
                              startPoint: .top,
                              endPoint: .bottom)
    }
}

