//
//  PulseViewModifier.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 5
//  Rhythmic trust pulse modifier
//

import SwiftUI

/// PulseViewModifier - Adds rhythmic pulsing animation
struct PulseViewModifier: ViewModifier {
    let frequency: Double // Pulses per second
    let intensity: Double // 0-1
    let color: Color
    @State private var pulsePhase: Double = 0.0

    init(
        frequency: Double = 1.0,
        intensity: Double = 0.5,
        color: Color = .trustEmerald
    ) {
        self.frequency = frequency
        self.intensity = intensity
        self.color = color
    }

    func body(content: Content) -> some View {
        content
            .scaleEffect(pulseScale)
            .opacity(pulseOpacity)
            .shadow(
                color: color.opacity(pulseShadowOpacity),
                radius: pulseShadowRadius,
                x: 0,
                y: 0
            )
            .onAppear {
                startPulse()
            }
    }

    private var pulseScale: CGFloat {
        let baseScale: CGFloat = 1.0
        let pulseAmount = sin(pulsePhase * .pi * 2) * CGFloat(intensity * 0.1)
        return baseScale + pulseAmount
    }

    private var pulseOpacity: Double {
        let baseOpacity: Double = 1.0
        let pulseAmount = sin(pulsePhase * .pi * 2) * (intensity * 0.1)
        return baseOpacity - pulseAmount
    }

    private var pulseShadowOpacity: Double {
        let baseOpacity = intensity * 0.3
        let pulseAmount = (sin(pulsePhase * .pi * 2) + 1) * 0.5 * (intensity * 0.3)
        return baseOpacity + pulseAmount
    }

    private var pulseShadowRadius: CGFloat {
        let baseRadius: CGFloat = 10
        let pulseAmount = (sin(pulsePhase * .pi * 2) + 1) * 0.5 * 10
        return baseRadius + pulseAmount
    }

    private func startPulse() {
        withAnimation(
            Animation.easeInOut(duration: 1.0 / frequency)
                .repeatForever(autoreverses: true)
        ) {
            pulsePhase = 1.0
        }
    }
}

extension View {
    /// Adds rhythmic pulsing animation
    /// - Parameters:
    ///   - frequency: Pulses per second (default: 1.0)
    ///   - intensity: Pulse intensity 0-1 (default: 0.5)
    ///   - color: Pulse color (default: emerald)
    func trustPulse(
        frequency: Double = 1.0,
        intensity: Double = 0.5,
        color: Color = .trustEmerald
    ) -> some View {
        modifier(PulseViewModifier(
            frequency: frequency,
            intensity: intensity,
            color: color
        ))
    }
}

