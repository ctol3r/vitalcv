//
//  LaunchScreen.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 4
//  Animated identity orb launch screen
//

import SwiftUI

/// LaunchScreen - Animated identity orb launch screen
/// Displays during app initialization with animated identity orb
struct LaunchScreen: View {
    @State private var orbScale: CGFloat = 0.8
    @State private var orbOpacity: Double = 0.3
    @State private var orbRotation: Double = 0
    @State private var pulseScale: CGFloat = 1.0
    @State private var innerGlow: Double = 0.0
    @State private var particles: [Particle] = []

    var body: some View {
        ZStack {
            // Background gradient
            RadialGradient(
                colors: [
                    Color.walletPrimary.opacity(0.15),
                    Color.walletBackground,
                    Color.walletBackground
                ],
                center: .center,
                startRadius: 50,
                endRadius: 400
            )
            .ignoresSafeArea()

            // Particle effects
            ForEach(particles) { particle in
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.walletPrimary.opacity(particle.opacity),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: particle.size
                        )
                    )
                    .frame(width: particle.size * 2, height: particle.size * 2)
                    .position(particle.position)
                    .opacity(particle.opacity)
            }

            // Identity Orb
            ZStack {
                // Outer glow rings
                ForEach(0..<3) { index in
                    Circle()
                        .stroke(
                            Color.walletPrimary.opacity(0.2 - Double(index) * 0.05),
                            lineWidth: 2
                        )
                        .frame(width: 240 + CGFloat(index * 40), height: 240 + CGFloat(index * 40))
                        .scaleEffect(pulseScale * (1.0 + Double(index) * 0.1))
                        .opacity(0.5 - Double(index) * 0.1)
                }

                // Main orb
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(0.9),
                                Color.walletPrimary.opacity(0.8),
                                Color.walletPrimary.opacity(0.4),
                                Color.walletPrimary.opacity(0.1)
                            ],
                            center: .center,
                            startRadius: 10,
                            endRadius: 100
                        )
                    )
                    .frame(width: 200, height: 200)
                    .scaleEffect(orbScale)
                    .rotationEffect(.degrees(orbRotation))
                    .overlay(
                        // Inner glow
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        Color.white.opacity(innerGlow),
                                        Color.clear
                                    ],
                                    center: .center,
                                    startRadius: 0,
                                    endRadius: 50
                                )
                            )
                            .frame(width: 100, height: 100)
                    )
                    .shadow(color: Color.walletPrimary.opacity(0.5), radius: 30, x: 0, y: 0)

                // Surface pattern
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.6),
                                Color.clear,
                                Color.white.opacity(0.3),
                                Color.clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 2
                    )
                    .frame(width: 200, height: 200)
                    .rotationEffect(.degrees(orbRotation))
            }
            .opacity(orbOpacity)
        }
        .onAppear {
            startAnimations()
        }
    }

    private func startAnimations() {
        // Orb entrance animation
        withAnimation(.easeOut(duration: 1.2)) {
            orbScale = 1.0
            orbOpacity = 1.0
        }

        // Continuous rotation
        withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
            orbRotation = 360
        }

        // Pulse animation
        withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
            pulseScale = 1.15
        }

        // Inner glow pulse
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            innerGlow = 0.8
        }

        // Generate particles
        generateParticles()
    }

    private func generateParticles() {
        var newParticles: [Particle] = []
        let center = CGPoint(x: UIScreen.main.bounds.width / 2, y: UIScreen.main.bounds.height / 2)

        for i in 0..<12 {
            let angle = Double(i) * (2 * .pi / 12)
            let distance: CGFloat = 150
            let particle = Particle(
                id: UUID(),
                position: CGPoint(
                    x: center.x + cos(angle) * distance,
                    y: center.y + sin(angle) * distance
                ),
                size: CGFloat.random(in: 3...8),
                opacity: Double.random(in: 0.3...0.7)
            )
            newParticles.append(particle)
        }

        particles = newParticles

        // Animate particles
        withAnimation(.easeInOut(duration: 3.0).repeatForever(autoreverses: true)) {
            for i in 0..<particles.count {
                let angle = Double(i) * (2 * .pi / 12)
                let distance: CGFloat = 180
                particles[i].position = CGPoint(
                    x: center.x + cos(angle) * distance,
                    y: center.y + sin(angle) * distance
                )
            }
        }
    }
}

// MARK: - Particle Model

struct Particle: Identifiable {
    let id: UUID
    var position: CGPoint
    let size: CGFloat
    var opacity: Double
}

#Preview {
    LaunchScreen()
}

