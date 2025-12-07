//
//  GlassEffectModifier.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 9
//  Layered glass effect for credential cards
//

import SwiftUI

/// Glass effect modifier for credential cards
/// Creates a layered glass morphism effect
struct GlassEffectModifier: ViewModifier {
    let intensity: Double
    let cornerRadius: CGFloat

    init(intensity: Double = 0.3, cornerRadius: CGFloat = 16) {
        self.intensity = intensity
        self.cornerRadius = cornerRadius
    }

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // Base layer with blur
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .fill(Color.white.opacity(0.1))
                        .background(
                            RoundedRectangle(cornerRadius: cornerRadius)
                                .fill(
                                    .ultraThinMaterial
                                )
                        )

                    // Overlay for depth
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.3),
                                    Color.white.opacity(0.05)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                }
            )
            .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
    }
}

extension View {
    func glassEffect(intensity: Double = 0.3, cornerRadius: CGFloat = 16) -> some View {
        modifier(GlassEffectModifier(intensity: intensity, cornerRadius: cornerRadius))
    }
}

