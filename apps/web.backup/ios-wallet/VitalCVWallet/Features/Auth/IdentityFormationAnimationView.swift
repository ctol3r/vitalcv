//
//  IdentityFormationAnimationView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 10
//  New user animation ("Your Identity Is Being Formed")
//

import SwiftUI

struct IdentityFormationAnimationView: View {
    @State private var animationPhase: AnimationPhase = .initializing
    @State private var particles: [Particle] = []
    @State private var identityGlow: CGFloat = 0.0
    @State private var rotationAngle: Double = 0

    enum AnimationPhase {
        case initializing
        case gathering
        case forming
        case complete
    }

    struct Particle: Identifiable {
        let id = UUID()
        var position: CGPoint
        var velocity: CGVector
        var opacity: Double
        var scale: CGFloat
    }

    var body: some View {
        ZStack {
            Color.walletBackground
                .ignoresSafeArea()

            // Particle field
            ForEach(particles) { particle in
                Circle()
                    .fill(Color.walletPrimary)
                    .frame(width: 4, height: 4)
                    .position(particle.position)
                    .opacity(particle.opacity)
                    .scaleEffect(particle.scale)
            }

            // Central identity orb
            ZStack {
                // Outer glow
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.walletPrimary.opacity(0.3),
                                Color.walletPrimary.opacity(0.0)
                            ],
                            center: .center,
                            startRadius: 50,
                            endRadius: 150
                        )
                    )
                    .frame(width: 300, height: 300)
                    .scaleEffect(1.0 + identityGlow * 0.2)
                    .opacity(0.5 + identityGlow * 0.5)

                // Middle ring
                Circle()
                    .stroke(Color.walletPrimary, lineWidth: 3)
                    .frame(width: 120, height: 120)
                    .rotationEffect(.degrees(rotationAngle))
                    .opacity(0.7)

                // Inner core
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.walletPrimary,
                                Color.walletSecondary
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)
                    .shadow(color: .walletPrimary.opacity(0.5), radius: 20)
            }

            // Text overlay
            VStack(spacing: WalletSpacing.md) {
                Spacer()

                Text(phaseText)
                    .font(WalletTypography.title1)
                    .foregroundColor(.walletText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)
                    .opacity(phaseTextOpacity)

                if animationPhase == .complete {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.walletSuccess)
                        .scaleEffect(completionScale)
                }

                Spacer()
                    .frame(height: 200)
            }
        }
        .onAppear {
            startAnimation()
        }
    }

    private var phaseText: String {
        switch animationPhase {
        case .initializing:
            return "Initializing..."
        case .gathering:
            return "Gathering Identity Data"
        case .forming:
            return "Your Identity Is Being Formed"
        case .complete:
            return "Identity Ready"
        }
    }

    private var phaseTextOpacity: Double {
        switch animationPhase {
        case .initializing, .gathering, .forming:
            return 1.0
        case .complete:
            return 0.0
        }
    }

    @State private var completionScale: CGFloat = 0.0

    private func startAnimation() {
        // Initialize particles
        particles = (0..<50).map { _ in
            Particle(
                position: CGPoint(
                    x: Double.random(in: 0...UIScreen.main.bounds.width),
                    y: Double.random(in: 0...UIScreen.main.bounds.height)
                ),
                velocity: CGVector(
                    dx: Double.random(in: -1...1),
                    dy: Double.random(in: -1...1)
                ),
                opacity: Double.random(in: 0.3...0.8),
                scale: CGFloat.random(in: 0.5...1.5)
            )
        }

        // Phase 1: Initializing (0.5s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.easeInOut(duration: 0.5)) {
                animationPhase = .gathering
            }
        }

        // Phase 2: Gathering (1.0s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.easeInOut(duration: 0.5)) {
                animationPhase = .forming
            }
        }

        // Phase 3: Forming (2.0s)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
            withAnimation(.easeInOut(duration: 0.5)) {
                animationPhase = .complete
            }

            // Completion animation
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                completionScale = 1.0
            }
        }

        // Continuous animations
        withAnimation(
            .easeInOut(duration: 2.0)
            .repeatForever(autoreverses: true)
        ) {
            identityGlow = 1.0
        }

        withAnimation(
            .linear(duration: 10.0)
            .repeatForever(autoreverses: false)
        ) {
            rotationAngle = 360
        }

        // Animate particles
        animateParticles()
    }

    private func animateParticles() {
        Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { timer in
            if animationPhase == .complete {
                timer.invalidate()
                return
            }

            particles = particles.map { particle in
                var updated = particle
                updated.position.x += updated.velocity.dx
                updated.position.y += updated.velocity.dy

                // Wrap around screen
                if updated.position.x < 0 {
                    updated.position.x = UIScreen.main.bounds.width
                } else if updated.position.x > UIScreen.main.bounds.width {
                    updated.position.x = 0
                }

                if updated.position.y < 0 {
                    updated.position.y = UIScreen.main.bounds.height
                } else if updated.position.y > UIScreen.main.bounds.height {
                    updated.position.y = 0
                }

                return updated
            }
        }
    }
}

#Preview {
    IdentityFormationAnimationView()
}








