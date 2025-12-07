//
//  TrustGlow.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 9
//  Trust glow for cards and icons with radius and strength control
//

import SwiftUI

/// TrustGlow - Dynamic glow effect for cards and icons
struct TrustGlow: ViewModifier {
    let radius: CGFloat
    let strength: Double
    let color: Color
    @State private var glowPhase: Double = 0.0

    init(
        radius: CGFloat = 20,
        strength: Double = 0.5,
        color: Color = .trustEmerald
    ) {
        self.radius = radius
        self.strength = strength
        self.color = color
    }

    func body(content: Content) -> some View {
        content
            .shadow(
                color: color.opacity(glowOpacity),
                radius: animatedRadius,
                x: 0,
                y: 0
            )
            .overlay(
                content
                    .blur(radius: radius * 0.4)
                    .opacity(strength * 0.15)
                    .blendMode(.overlay)
            )
            .onAppear {
                startGlowAnimation()
            }
    }

    private var glowOpacity: Double {
        let baseOpacity = strength * 0.4
        let oscillation = sin(glowPhase * .pi * 2) * 0.15
        return baseOpacity + oscillation
    }

    private var animatedRadius: CGFloat {
        let baseRadius = radius
        let oscillation = sin(glowPhase * .pi * 2) * 5
        return baseRadius + oscillation
    }

    private func startGlowAnimation() {
        withAnimation(
            TrustMotionConfig.trustGlow
        ) {
            glowPhase = 1.0
        }
    }
}

extension View {
    /// Adds trust glow to cards and icons
    /// - Parameters:
    ///   - radius: Glow radius in points (default: 20)
    ///   - strength: Glow strength 0-1 (default: 0.5)
    func trustGlow(
        radius: CGFloat = 20,
        strength: Double = 0.5
    ) -> some View {
        modifier(TrustGlow(
            radius: radius,
            strength: strength,
            color: .trustEmerald
        ))
    }

    /// Adds trust glow with custom color
    func trustGlow(
        radius: CGFloat = 20,
        strength: Double = 0.5,
        color: Color
    ) -> some View {
        modifier(TrustGlow(
            radius: radius,
            strength: strength,
            color: color
        ))
    }
}

