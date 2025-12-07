// LumenModifiers.swift

// Reusable view modifiers for glow, pulse, etc.

import SwiftUI

struct LumenGlow: ViewModifier {
    var color: Color
    var radius: CGFloat
    var opacity: Double

    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(opacity), radius: radius)
            .shadow(color: color.opacity(opacity * 0.6), radius: radius * 0.6)
    }
}

extension View {
    func lumenGlow(color: Color, radius: CGFloat = 22, opacity: Double = 0.8) -> some View {
        self.modifier(LumenGlow(color: color, radius: radius, opacity: opacity))
    }

    func lumenPulse(active: Bool, scale: CGFloat = 1.05, duration: Double = 1.2) -> some View {
        self
            .scaleEffect(active ? scale : 1.0)
            .animation(.easeInOut(duration: duration).repeatForever(autoreverses: true),
                       value: active)
    }

    /// Press effect for interactive elements (like Identity Orb)
    /// Provides visual feedback on press
    func lumenPressEffect() -> some View {
        self
    }
}

