//
//  GlowLayerViewModifier.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 4
//  Dynamic glow layer modifier for trust indicators
//

import SwiftUI

/// GlowLayerViewModifier - Adds dynamic glow effects to views
struct GlowLayerViewModifier: ViewModifier {
    let radius: CGFloat
    let strength: Double
    let color: Color
    let phase: Double
    let isAnimated: Bool

    init(
        radius: CGFloat = 20,
        strength: Double = 0.5,
        color: Color = .trustEmerald,
        phase: Double = 0.0,
        isAnimated: Bool = true
    ) {
        self.radius = radius
        self.strength = strength
        self.color = color
        self.phase = phase
        self.isAnimated = isAnimated
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
                // Inner glow layer
                content
                    .blur(radius: innerBlurRadius)
                    .opacity(innerGlowOpacity)
                    .blendMode(.overlay)
            )
    }

    private var glowOpacity: Double {
        if isAnimated {
            let baseOpacity = strength * 0.4
            let oscillation = sin(phase * .pi * 2) * 0.15
            return baseOpacity + oscillation
        } else {
            return strength * 0.4
        }
    }

    private var animatedRadius: CGFloat {
        if isAnimated {
            let baseRadius = radius
            let oscillation = sin(phase * .pi * 2) * 5
            return baseRadius + oscillation
        } else {
            return radius
        }
    }

    private var innerBlurRadius: CGFloat {
        radius * 0.3
    }

    private var innerGlowOpacity: Double {
        strength * 0.2
    }
}

extension View {
    /// Adds a dynamic glow layer to the view
    /// - Parameters:
    ///   - radius: Glow radius (default: 20)
    ///   - strength: Glow strength 0-1 (default: 0.5)
    ///   - color: Glow color (default: emerald)
    ///   - phase: Animation phase 0-1 (default: 0)
    ///   - isAnimated: Whether to animate the glow (default: true)
    func glowLayer(
        radius: CGFloat = 20,
        strength: Double = 0.5,
        color: Color = .trustEmerald,
        phase: Double = 0.0,
        isAnimated: Bool = true
    ) -> some View {
        modifier(GlowLayerViewModifier(
            radius: radius,
            strength: strength,
            color: color,
            phase: phase,
            isAnimated: isAnimated
        ))
    }
}

