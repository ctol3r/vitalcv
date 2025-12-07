//
//  IdentityOrbFlourishView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 9
//  Identity orb flourish animation
//

import SwiftUI

/// IdentityOrbFlourishView - Animated identity orb with flourish effects
struct IdentityOrbFlourishView: View {
    @State private var isAnimating = false
    @State private var pulseScale: CGFloat = 1.0
    @State private var rotation: Double = 0
    @State private var particles: [Particle] = []

    var body: some View {
        ZStack {
            // Orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.walletPrimary.opacity(0.8),
                            Color.walletPrimary.opacity(0.4),
                            Color.walletPrimary.opacity(0.1)
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 100
                    )
                )
                .frame(width: 120, height: 120)
                .scaleEffect(pulseScale)
                .rotationEffect(.degrees(rotation))
                .blur(radius: isAnimating ? 10 : 0)

            // Inner core
            Circle()
                .fill(Color.walletPrimary)
                .frame(width: 60, height: 60)
                .overlay(
                    Image(systemName: "person.fill")
                        .foregroundColor(.white)
                        .font(.system(size: 24))
                )

            // Particles
            ForEach(particles) { particle in
                Circle()
                    .fill(Color.walletPrimary.opacity(particle.opacity))
                    .frame(width: particle.size, height: particle.size)
                    .position(particle.position)
            }
        }
        .onAppear {
            startAnimation()
        }
    }

    private func startAnimation() {
        // Pulse animation
        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            pulseScale = 1.2
        }

        // Rotation animation
        withAnimation(
            Animation.linear(duration: 10.0)
                .repeatForever(autoreverses: false)
        ) {
            rotation = 360
        }

        // Particle generation
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
            generateParticle()
        }

        isAnimating = true
    }

    private func generateParticle() {
        let angle = Double.random(in: 0...(2 * .pi))
        let distance = CGFloat.random(in: 60...120)
        let x = cos(angle) * distance
        let y = sin(angle) * distance

        let particle = Particle(
            id: UUID(),
            position: CGPoint(x: 60 + x, y: 60 + y),
            size: CGFloat.random(in: 4...8),
            opacity: Double.random(in: 0.3...0.8)
        )

        particles.append(particle)

        // Remove particle after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            particles.removeAll { $0.id == particle.id }
        }
    }
}

struct Particle: Identifiable {
    let id: UUID
    var position: CGPoint
    let size: CGFloat
    let opacity: Double
}

#Preview {
    IdentityOrbFlourishView()
        .frame(width: 200, height: 200)
        .background(Color.walletBackground)
}

