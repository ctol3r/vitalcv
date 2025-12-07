//
//  TrustPulse.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 10
//  Repeating gentle light expansion pulse
//

import SwiftUI

/// TrustPulse - Gentle repeating pulse animation
struct TrustPulse: ViewModifier {
    let frequency: Double
    let intensity: Double
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 1.0

    init(
        frequency: Double = 1.0,
        intensity: Double = 0.5
    ) {
        self.frequency = frequency
        self.intensity = intensity
    }

    func body(content: Content) -> some View {
        content
            .scaleEffect(pulseScale)
            .opacity(pulseOpacity)
            .onAppear {
                startPulse()
            }
    }

    private func startPulse() {
        withAnimation(
            Animation.easeInOut(duration: 1.0 / frequency)
                .repeatForever(autoreverses: true)
        ) {
            pulseScale = 1.0 + CGFloat(intensity * 0.1)
            pulseOpacity = 1.0 - (intensity * 0.15)
        }
    }
}

/// TrustPulseRipple - Expanding ripple effect
struct TrustPulseRipple: View {
    let color: Color
    let count: Int
    @State private var ripples: [RippleState] = []

    struct RippleState: Identifiable {
        let id: UUID
        var scale: CGFloat
        var opacity: Double
    }

    init(color: Color = .trustEmerald, count: Int = 3) {
        self.color = color
        self.count = count
    }

    var body: some View {
        ZStack {
            ForEach(ripples) { ripple in
                Circle()
                    .stroke(color.opacity(ripple.opacity), lineWidth: 2)
                    .frame(width: 60, height: 60)
                    .scaleEffect(ripple.scale)
            }
        }
        .onAppear {
            generateRipples()
        }
    }

    private func generateRipples() {
        for i in 0..<count {
            let ripple = RippleState(
                id: UUID(),
                scale: 0.5,
                opacity: 0.8
            )
            ripples.append(ripple)

            // Animate each ripple with delay
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.3) {
                animateRipple(id: ripple.id)
            }
        }
    }

    private func animateRipple(id: UUID) {
        guard let index = ripples.firstIndex(where: { $0.id == id }) else { return }

        withAnimation(
            Animation.easeOut(duration: 1.5)
                .repeatForever(autoreverses: false)
        ) {
            ripples[index].scale = 2.5
            ripples[index].opacity = 0.0
        }
    }
}

extension View {
    /// Adds repeating gentle pulse animation
    func trustPulse(
        frequency: Double = 1.0,
        intensity: Double = 0.5
    ) -> some View {
        modifier(TrustPulse(
            frequency: frequency,
            intensity: intensity
        ))
    }
}

