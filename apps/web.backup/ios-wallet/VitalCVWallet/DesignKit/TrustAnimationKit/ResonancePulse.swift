//
//  ResonancePulse.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 40
//  Final resonance pulse used on 100% trust success
//

import SwiftUI

/// ResonancePulse - Final resonance pulse for 100% trust success
struct ResonancePulse: View {
    let trustScore: Double // Should be 100 for full resonance
    @State private var resonancePhase: Double = 0.0
    @State private var pulseRings: [PulseRing] = []

    struct PulseRing: Identifiable {
        let id: UUID
        var scale: CGFloat
        var opacity: Double
        var rotation: Double
    }

    var body: some View {
        ZStack {
            // Pulse rings
            ForEach(pulseRings) { ring in
                Circle()
                    .stroke(
                        Color.trustEmerald.opacity(ring.opacity),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                    .frame(width: 200, height: 200)
                    .scaleEffect(ring.scale)
                    .rotationEffect(.degrees(ring.rotation))
            }

            // Central orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.trustEmerald.opacity(0.9),
                            Color.trustEmerald.opacity(0.6),
                            Color.trustEmerald.opacity(0.3)
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: 80
                    )
                )
                .frame(width: 160, height: 160)
                .scaleEffect(1.0 + sin(resonancePhase * .pi * 2) * 0.1)
                .shadow(
                    color: Color.trustEmerald.opacity(0.6),
                    radius: 30,
                    x: 0,
                    y: 0
                )

            // Success icon
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 60, weight: .bold))
                .foregroundColor(.white)
                .scaleEffect(1.0 + sin(resonancePhase * .pi * 2) * 0.05)
        }
        .onAppear {
            if trustScore >= 100 {
                triggerResonance()
            }
        }
        .onChange(of: trustScore) { score in
            if score >= 100 && pulseRings.isEmpty {
                triggerResonance()
            }
        }
    }

    private func triggerResonance() {
        // Generate initial pulse rings
        generateResonanceRings()

        // Start continuous resonance
        startContinuousResonance()

        // Haptic and sound feedback
        TrustHapticEngine.shared.verificationSuccess()
        TrustTickSound.shared.playBloom()
    }

    private func generateResonanceRings() {
        let ringCount = 6

        for i in 0..<ringCount {
            let ring = PulseRing(
                id: UUID(),
                scale: 0.5,
                opacity: 0.8,
                rotation: Double(i) * 30
            )

            pulseRings.append(ring)

            // Animate ring with delay
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.2) {
                animateRing(id: ring.id)
            }
        }
    }

    private func animateRing(id: UUID) {
        guard let index = pulseRings.firstIndex(where: { $0.id == id }) else { return }

        // Expand ring
        withAnimation(
            Animation.easeOut(duration: 2.0)
        ) {
            pulseRings[index].scale = 3.0
            pulseRings[index].opacity = 0.0
            pulseRings[index].rotation += 180
        }

        // Remove and regenerate
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if index < pulseRings.count {
                pulseRings.remove(at: index)

                // Regenerate if still at 100%
                if trustScore >= 100 {
                    let newRing = PulseRing(
                        id: UUID(),
                        scale: 0.5,
                        opacity: 0.8,
                        rotation: Double.random(in: 0...360)
                    )
                    pulseRings.append(newRing)
                    animateRing(id: newRing.id)
                }
            }
        }
    }

    private func startContinuousResonance() {
        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            resonancePhase = 1.0
        }
    }
}

/// TrustSuccessView - Complete success view with resonance
struct TrustSuccessView: View {
    let trustScore: Double
    let message: String

    var body: some View {
        VStack(spacing: 24) {
            ResonancePulse(trustScore: trustScore)
                .frame(width: 300, height: 300)

            Text("100% Trust Verified")
                .font(WalletTypography.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(.trustEmerald)

            Text(message)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .background(
            RoundedRectangle(cornerRadius: 24)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
        )
        .trustHorizon(state: .passed, trustScore: trustScore)
    }
}

extension View {
    /// Adds final resonance pulse for 100% trust success
    func resonancePulse(trustScore: Double) -> some View {
        overlay(
            ResonancePulse(trustScore: trustScore)
                .allowsHitTesting(false)
        )
    }
}

