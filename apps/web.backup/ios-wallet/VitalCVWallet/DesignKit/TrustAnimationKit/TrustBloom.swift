//
//  TrustBloom.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 11
//  Bloom animation used on successful verification
//

import SwiftUI

/// TrustBloom - Celebration bloom animation for successful verification
struct TrustBloom: View {
    let state: TrustState
    @State private var isBloomActive = false
    @State private var particles: [BloomParticle] = []
    @State private var centerScale: CGFloat = 1.0
    @State private var centerOpacity: Double = 1.0

    var body: some View {
        ZStack {
            // Center bloom orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: bloomColors,
                        center: .center,
                        startRadius: 30,
                        endRadius: 120
                    )
                )
                .frame(width: 120, height: 120)
                .scaleEffect(centerScale)
                .opacity(centerOpacity)
                .blur(radius: isBloomActive ? 20 : 0)

            // Bloom particles
            ForEach(particles) { particle in
                Circle()
                    .fill(particle.color)
                    .frame(width: particle.size, height: particle.size)
                    .position(particle.position)
                    .opacity(particle.opacity)
            }

            // Central icon
            Image(systemName: state.icon)
                .font(.system(size: 40, weight: .bold))
                .foregroundColor(.white)
                .scaleEffect(centerScale)
        }
        .onAppear {
            triggerBloom()
        }
    }

    private var bloomColors: [Color] {
        let baseColor = TrustColorPalette.color(for: state, intensity: 0.8)
        return [
            baseColor.opacity(0.9),
            baseColor.opacity(0.6),
            baseColor.opacity(0.3),
            baseColor.opacity(0.0)
        ]
    }

    private func triggerBloom() {
        // Initial scale-up
        withAnimation(TrustMotionConfig.bouncySpring) {
            centerScale = 1.3
            isBloomActive = true
        }

        // Generate particles
        generateParticles()

        // Settle animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            withAnimation(TrustMotionConfig.smoothSpring) {
                centerScale = 1.1
                centerOpacity = 0.9
            }
        }
    }

    private func generateParticles() {
        let center = CGPoint(x: 60, y: 60)
        let particleCount = 16
        let particleColor = TrustColorPalette.color(for: state, intensity: 0.7)

        for i in 0..<particleCount {
            let angle = Double(i) * (2 * .pi / Double(particleCount))
            let distance: CGFloat = 100
            let targetX = center.x + cos(angle) * distance
            let targetY = center.y + sin(angle) * distance

            let particle = BloomParticle(
                id: UUID(),
                position: center,
                targetPosition: CGPoint(x: targetX, y: targetY),
                size: CGFloat.random(in: 6...14),
                color: particleColor,
                opacity: Double.random(in: 0.7...1.0)
            )

            particles.append(particle)

            // Animate particle outward
            withAnimation(
                Animation.easeOut(duration: 1.2)
                    .delay(Double(i) * 0.05)
            ) {
                if let index = particles.firstIndex(where: { $0.id == particle.id }) {
                    particles[index].position = particle.targetPosition
                    particles[index].opacity = 0.0
                    particles[index].size *= 1.5
                }
            }
        }

        // Cleanup
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            particles.removeAll()
        }
    }
}

struct BloomParticle: Identifiable {
    let id: UUID
    var position: CGPoint
    let targetPosition: CGPoint
    var size: CGFloat
    let color: Color
    var opacity: Double
}

extension View {
    /// Adds trust bloom animation on appear
    func trustBloom(state: TrustState) -> some View {
        overlay(
            TrustBloom(state: state)
                .allowsHitTesting(false)
        )
    }
}

