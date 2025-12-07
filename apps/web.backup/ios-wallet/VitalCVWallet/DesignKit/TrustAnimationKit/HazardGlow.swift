//
//  HazardGlow.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 13
//  Amber flicker glow for warnings
//

import SwiftUI

/// HazardGlow - Amber flickering glow for warning states
struct HazardGlow: ViewModifier {
    let intensity: Double
    @State private var flickerPhase: Double = 0.0
    @State private var flickerAmount: Double = 0.0

    init(intensity: Double = 0.7) {
        self.intensity = intensity
    }

    func body(content: Content) -> some View {
        content
            .shadow(
                color: .trustAmber.opacity(glowOpacity),
                radius: glowRadius,
                x: 0,
                y: 0
            )
            .overlay(
                content
                    .blur(radius: 8)
                    .opacity(flickerOpacity)
                    .blendMode(.overlay)
            )
            .onAppear {
                startFlicker()
            }
    }

    private var glowOpacity: Double {
        let baseOpacity = intensity * 0.4
        let flicker = flickerAmount * 0.3
        return baseOpacity + flicker
    }

    private var glowRadius: CGFloat {
        let baseRadius: CGFloat = 15
        let flicker = CGFloat(flickerAmount * 8)
        return baseRadius + flicker
    }

    private var flickerOpacity: Double {
        let baseOpacity = intensity * 0.15
        let flicker = flickerAmount * 0.2
        return baseOpacity + flicker
    }

    private func startFlicker() {
        // Random flicker pattern
        Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { _ in
            withAnimation(
                Animation.easeInOut(duration: 0.15)
            ) {
                // Random flicker between 0 and 1
                flickerAmount = Double.random(in: 0.0...1.0)
            }
        }

        // Continuous phase animation
        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            flickerPhase = 1.0
        }
    }
}

/// HazardPulseView - Visible warning indicator
struct HazardPulseView: View {
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 0.8

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        Color.trustAmber.opacity(0.8),
                        Color.trustAmber.opacity(0.0)
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: 50
                )
            )
            .frame(width: 100, height: 100)
            .scaleEffect(pulseScale)
            .opacity(pulseOpacity)
            .modifier(HazardGlow(intensity: 0.8))
            .onAppear {
                startPulse()
            }
    }

    private func startPulse() {
        withAnimation(
            Animation.easeInOut(duration: 1.2)
                .repeatForever(autoreverses: true)
        ) {
            pulseScale = 1.3
            pulseOpacity = 0.4
        }
    }
}

extension View {
    /// Adds hazard glow (amber flicker) for warnings
    func hazardGlow(intensity: Double = 0.7) -> some View {
        modifier(HazardGlow(intensity: intensity))
    }
}

