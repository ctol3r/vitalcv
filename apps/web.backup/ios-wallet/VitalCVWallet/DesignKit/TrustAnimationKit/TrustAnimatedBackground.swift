//
//  TrustAnimatedBackground.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 8
//  Reusable animated background for all verification screens
//

import SwiftUI

/// TrustAnimatedBackground - Animated background for verification screens
struct TrustAnimatedBackground: View {
    let state: TrustState
    let trustScore: Double
    @State private var animationPhase: Double = 0.0

    var body: some View {
        ZStack {
            // Base gradient
            baseGradient
                .ignoresSafeArea()

            // Animated orbs
            ForEach(0..<3) { index in
                animatedOrb(index: index)
            }

            // Subtle grid pattern
            gridPattern
                .opacity(0.1)
        }
        .onAppear {
            startAnimation()
        }
    }

    private var baseGradient: LinearGradient {
        let colors = TrustColorPalette.color(for: state, intensity: 0.1)

        return LinearGradient(
            colors: [
                colors.opacity(0.3),
                colors.opacity(0.1),
                Color.walletBackground
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private func animatedOrb(index: Int) -> some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        TrustColorPalette.color(for: state, intensity: 0.3).opacity(0.4),
                        TrustColorPalette.color(for: state, intensity: 0.3).opacity(0.0)
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: 100
                )
            )
            .frame(width: 200, height: 200)
            .offset(
                x: sin(animationPhase + Double(index) * 2.0) * 100,
                y: cos(animationPhase + Double(index) * 2.0) * 80
            )
            .blur(radius: 40)
    }

    private var gridPattern: some View {
        GeometryReader { geometry in
            Path { path in
                let spacing: CGFloat = 40

                // Vertical lines
                for x in stride(from: 0, through: geometry.size.width, by: spacing) {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: geometry.size.height))
                }

                // Horizontal lines
                for y in stride(from: 0, through: geometry.size.height, by: spacing) {
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: geometry.size.width, y: y))
                }
            }
            .stroke(
                TrustColorPalette.color(for: state, intensity: 0.5),
                lineWidth: 1
            )
        }
    }

    private func startAnimation() {
        withAnimation(
            Animation.linear(duration: 10.0)
                .repeatForever(autoreverses: false)
        ) {
            animationPhase = 2 * .pi
        }
    }
}

/// Simplified background variant for cards
struct TrustCardBackground: View {
    let state: TrustState

    var body: some View {
        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
            .fill(
                LinearGradient(
                    colors: [
                        TrustColorPalette.color(for: state, intensity: 0.05),
                        TrustColorPalette.color(for: state, intensity: 0.02)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
    }
}

extension View {
    /// Applies trust animated background
    func trustAnimatedBackground(state: TrustState, trustScore: Double = 0.0) -> some View {
        ZStack {
            TrustAnimatedBackground(state: state, trustScore: trustScore)
            self
        }
    }

    /// Applies trust card background
    func trustCardBackground(state: TrustState) -> some View {
        background(TrustCardBackground(state: state))
    }
}

