//
//  ChainGlowViewModifier.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 5
//  Chain glow modifier (soft edge light for anchored status)
//

import SwiftUI

/// ChainGlowViewModifier - Adds soft edge glow for anchored chain status
struct ChainGlowViewModifier: ViewModifier {
    let color: Color
    let intensity: Double
    let radius: CGFloat

    init(
        color: Color = ChainColorPalette.emerald,
        intensity: Double = 0.6,
        radius: CGFloat = 20
    ) {
        self.color = color
        self.intensity = intensity
        self.radius = radius
    }

    func body(content: Content) -> some View {
        content
            .shadow(
                color: color.opacity(intensity),
                radius: radius,
                x: 0,
                y: 0
            )
            .shadow(
                color: color.opacity(intensity * 0.5),
                radius: radius * 1.5,
                x: 0,
                y: 0
            )
    }
}

extension View {
    /// Apply chain glow effect
    func chainGlow(
        color: Color = ChainColorPalette.emerald,
        intensity: Double = 0.6,
        radius: CGFloat = 20
    ) -> some View {
        modifier(ChainGlowViewModifier(
            color: color,
            intensity: intensity,
            radius: radius
        ))
    }
}








