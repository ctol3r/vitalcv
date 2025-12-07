//
//  CinemographIntroAnimation.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 11
//  Cinemograph intro animation for onboarding
//

import SwiftUI

/// CinemographIntroAnimation - Subtle motion animation for intro screens
/// Creates a "living photograph" effect with gentle, continuous motion
struct CinemographIntroAnimation: View {
    @State private var animationPhase: Double = 0
    @State private var particleOffset: CGFloat = 0
    @State private var glowIntensity: Double = 0.5

    var body: some View {
        ZStack {
            // Base gradient background with subtle motion
            AnimatedGradientBackground(phase: animationPhase)
                .ignoresSafeArea()

            // Floating particles
            ParticleField(offset: particleOffset)

            // Pulsing glow effect
            RadialGradient(
                colors: [
                    Color.walletPrimary.opacity(glowIntensity * 0.3),
                    Color.walletPrimary.opacity(0)
                ],
                center: .center,
                startRadius: 50,
                endRadius: 300
            )
            .ignoresSafeArea()
        }
        .onAppear {
            startAnimations()
        }
    }

    private func startAnimations() {
        // Continuous gradient phase animation
        withAnimation(
            Animation.linear(duration: 20.0)
                .repeatForever(autoreverses: false)
        ) {
            animationPhase = 1.0
        }

        // Particle drift animation
        withAnimation(
            Animation.easeInOut(duration: 8.0)
                .repeatForever(autoreverses: true)
        ) {
            particleOffset = 100
        }

        // Glow pulse animation
        withAnimation(
            Animation.easeInOut(duration: 3.0)
                .repeatForever(autoreverses: true)
        ) {
            glowIntensity = 0.8
        }
    }
}

// MARK: - Animated Gradient Background

struct AnimatedGradientBackground: View {
    let phase: Double

    var body: some View {
        LinearGradient(
            colors: [
                Color.walletBackground,
                Color.walletPrimary.opacity(0.1),
                Color.walletSecondary.opacity(0.05),
                Color.walletBackground
            ],
            startPoint: UnitPoint(
                x: 0.5 + sin(phase * .pi * 2) * 0.3,
                y: 0.5 + cos(phase * .pi * 2) * 0.3
            ),
            endPoint: UnitPoint(
                x: 0.5 - sin(phase * .pi * 2) * 0.3,
                y: 0.5 - cos(phase * .pi * 2) * 0.3
            )
        )
    }
}

// MARK: - Particle Field

struct ParticleField: View {
    let offset: CGFloat

    var body: some View {
        GeometryReader { geometry in
            ForEach(0..<20, id: \.self) { index in
                Circle()
                    .fill(
                        Color.walletPrimary.opacity(
                            Double.random(in: 0.1...0.3)
                        )
                    )
                    .frame(width: CGFloat.random(in: 2...6))
                    .position(
                        x: CGFloat.random(in: 0...geometry.size.width),
                        y: CGFloat.random(in: 0...geometry.size.height) + offset
                    )
                    .blur(radius: 1)
            }
        }
    }
}

// MARK: - Cinemograph Modifier

struct CinemographModifier: ViewModifier {
    @State private var animationPhase: Double = 0

    func body(content: Content) -> some View {
        content
            .background(
                AnimatedGradientBackground(phase: animationPhase)
                    .ignoresSafeArea()
            )
            .overlay(
                ParticleField(offset: sin(animationPhase * .pi * 2) * 50)
                    .opacity(0.3)
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 20.0)
                        .repeatForever(autoreverses: false)
                ) {
                    animationPhase = 1.0
                }
            }
    }
}

extension View {
    /// Apply cinemograph intro animation effect
    func cinemographIntro() -> some View {
        modifier(CinemographModifier())
    }
}

#Preview {
    CinemographIntroAnimation()
}

