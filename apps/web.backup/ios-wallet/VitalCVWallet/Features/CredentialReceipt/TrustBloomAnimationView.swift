//
//  TrustBloomAnimationView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 29
//  Acceptance animation with trust bloom
//

import SwiftUI

/// TrustBloomAnimationView - Trust bloom animation for credential acceptance
struct TrustBloomAnimationView: View {
    @State private var isAnimating = false
    @State private var particles: [BloomParticle] = []
    @State private var trustLevel: TrustLevel = .high

    var body: some View {
        ZStack {
            // Central trust orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: trustGradient,
                        center: .center,
                        startRadius: 20,
                        endRadius: 100
                    )
                )
                .frame(width: 120, height: 120)
                .scaleEffect(isAnimating ? 1.3 : 1.0)
                .opacity(isAnimating ? 0.8 : 1.0)
                .blur(radius: isAnimating ? 15 : 0)

            // Bloom particles
            ForEach(particles) { particle in
                Circle()
                    .fill(particle.color)
                    .frame(width: particle.size, height: particle.size)
                    .position(particle.position)
                    .opacity(particle.opacity)
            }

            // Trust icon
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 40))
                .foregroundColor(.white)
        }
        .onAppear {
            startBloomAnimation()
        }
    }

    private var trustGradient: [Color] {
        switch trustLevel {
        case .verified, .high:
            return [
                Color.walletSuccess.opacity(0.8),
                Color.walletSuccess.opacity(0.4),
                Color.walletSuccess.opacity(0.1)
            ]
        case .medium:
            return [
                Color.walletWarning.opacity(0.8),
                Color.walletWarning.opacity(0.4),
                Color.walletWarning.opacity(0.1)
            ]
        case .low, .untrusted:
            return [
                Color.walletError.opacity(0.8),
                Color.walletError.opacity(0.4),
                Color.walletError.opacity(0.1)
            ]
        }
    }

    private func startBloomAnimation() {
        // Pulse animation
        withAnimation(
            Animation.easeInOut(duration: 1.5)
                .repeatForever(autoreverses: true)
        ) {
            isAnimating = true
        }

        // Generate bloom particles
        generateBloomParticles()
    }

    private func generateBloomParticles() {
        let center = CGPoint(x: 60, y: 60)
        let particleCount = 12

        for i in 0..<particleCount {
            let angle = Double(i) * (2 * .pi / Double(particleCount))
            let distance: CGFloat = 80
            let x = center.x + cos(angle) * distance
            let y = center.y + sin(angle) * distance

            let particle = BloomParticle(
                id: UUID(),
                position: center,
                targetPosition: CGPoint(x: x, y: y),
                size: CGFloat.random(in: 6...12),
                color: trustColor,
                opacity: Double.random(in: 0.6...1.0)
            )

            particles.append(particle)

            // Animate particle to target
            withAnimation(
                Animation.easeOut(duration: 1.5)
                    .delay(Double(i) * 0.1)
            ) {
                if let index = particles.firstIndex(where: { $0.id == particle.id }) {
                    particles[index].position = particle.targetPosition
                    particles[index].opacity = 0.0
                }
            }
        }

        // Remove particles after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            particles.removeAll()
        }
    }

    private var trustColor: Color {
        switch trustLevel {
        case .verified, .high: return .walletSuccess
        case .medium: return .walletWarning
        case .low, .untrusted: return .walletError
        }
    }
}

// MARK: - Bloom Particle

struct BloomParticle: Identifiable {
    let id: UUID
    var position: CGPoint
    let targetPosition: CGPoint
    let size: CGFloat
    let color: Color
    var opacity: Double
}

// MARK: - Enhanced Acceptance View

extension CredentialAcceptanceView {
    /// Enhanced with trust bloom animation
    var trustBloomView: some View {
        ZStack {
            TrustBloomAnimationView(trustLevel: calculateTrustLevel())

            VStack {
                Text("Accepting Credential...")
                    .font(WalletTypography.title2)
                    .foregroundColor(.walletText)
                    .padding(.top, 150)
            }
        }
    }

    private func calculateTrustLevel() -> TrustLevel {
        // Calculate trust level based on credential
        // Simplified - in production use actual trust assessment
        return .high
    }
}

#Preview {
    TrustBloomAnimationView()
        .frame(width: 200, height: 200)
        .background(Color.walletBackground)
}

