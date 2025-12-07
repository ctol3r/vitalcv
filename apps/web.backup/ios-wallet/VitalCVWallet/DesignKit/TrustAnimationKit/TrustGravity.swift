//
//  TrustGravity.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 23
//  Trust gravity: elements subtly pulled toward strong proofs
//

import SwiftUI

/// TrustGravity - Elements subtly pulled toward strong proofs
struct TrustGravity: ViewModifier {
    let strength: Double // 0-1, strength of gravity
    let targetPosition: CGPoint
    @State private var currentOffset: CGSize = .zero

    init(strength: Double, targetPosition: CGPoint) {
        self.strength = max(0.0, min(1.0, strength))
        self.targetPosition = targetPosition
    }

    func body(content: Content) -> some View {
        content
            .offset(currentOffset)
            .onAppear {
                applyGravity()
            }
    }

    private func applyGravity() {
        // Calculate direction to target
        let gravityAmount = CGFloat(strength * 5)

        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            currentOffset = CGSize(
                width: cos(Double.random(in: 0...(2 * .pi))) * gravityAmount,
                height: sin(Double.random(in: 0...(2 * .pi))) * gravityAmount
            )
        }
    }
}

/// TrustGravityField - Creates a gravity field effect
struct TrustGravityField: View {
    let proofStrength: Double // 0-100
    let proofPosition: CGPoint
    let elements: [GravityElement]

    struct GravityElement: Identifiable {
        let id: UUID
        var position: CGPoint
        var currentOffset: CGSize
    }

    var body: some View {
        ZStack {
            ForEach(elements) { element in
                Circle()
                    .fill(Color.trustEmerald.opacity(0.3))
                    .frame(width: 20, height: 20)
                    .position(
                        x: element.position.x + element.currentOffset.width,
                        y: element.position.y + element.currentOffset.height
                    )
                    .modifier(
                        TrustGravity(
                            strength: proofStrength / 100.0,
                            targetPosition: proofPosition
                        )
                    )
            }
        }
    }
}

/// ProofGravityOrb - Orb that attracts other elements
struct ProofGravityOrb: View {
    let trustScore: Double
    let size: CGFloat
    @State private var orbScale: CGFloat = 1.0
    @State private var glowIntensity: Double = 0.5

    var body: some View {
        ZStack {
            // Outer glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            orbColor.opacity(glowIntensity * 0.4),
                            orbColor.opacity(0.0)
                        ],
                        center: .center,
                        startRadius: size * 0.5,
                        endRadius: size * 1.5
                    )
                )
                .frame(width: size * 3, height: size * 3)
                .blur(radius: 20)

            // Main orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            orbColor.opacity(0.9),
                            orbColor.opacity(0.6)
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: size * 0.5
                    )
                )
                .frame(width: size, height: size)
                .scaleEffect(orbScale)
                .shadow(
                    color: orbColor.opacity(0.5),
                    radius: 15,
                    x: 0,
                    y: 0
                )
        }
        .onAppear {
            startPulse()
        }
    }

    private var orbColor: Color {
        if trustScore >= 80 {
            return .trustEmerald
        } else if trustScore >= 60 {
            return .trustAmber
        } else {
            return .trustIndigo
        }
    }

    private func startPulse() {
        glowIntensity = trustScore / 100.0

        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            orbScale = 1.1
            glowIntensity = min(1.0, glowIntensity + 0.2)
        }
    }
}

extension View {
    /// Adds trust gravity effect (pulled toward strong proofs)
    func trustGravity(strength: Double, targetPosition: CGPoint) -> some View {
        modifier(TrustGravity(strength: strength, targetPosition: targetPosition))
    }
}

