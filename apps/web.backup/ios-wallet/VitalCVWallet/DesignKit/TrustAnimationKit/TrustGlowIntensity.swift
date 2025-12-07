//
//  TrustGlowIntensity.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 16
//  Link trust glow intensity directly to trust score (0-100)
//

import SwiftUI

/// TrustGlowIntensity - Dynamic glow intensity based on trust score
struct TrustGlowIntensity: ViewModifier {
    let trustScore: Double // 0-100
    let radius: CGFloat
    @State private var glowPhase: Double = 0.0

    init(trustScore: Double, radius: CGFloat = 20) {
        self.trustScore = max(0.0, min(100.0, trustScore))
        self.radius = radius
    }

    func body(content: Content) -> some View {
        content
            .shadow(
                color: glowColor.opacity(glowOpacity),
                radius: animatedRadius,
                x: 0,
                y: 0
            )
            .overlay(
                content
                    .blur(radius: radius * intensityMultiplier * 0.5)
                    .opacity(intensityMultiplier * 0.2)
                    .blendMode(.overlay)
            )
            .onAppear {
                startGlowAnimation()
            }
            .onChange(of: trustScore) { newScore in
                // Trigger haptic on significant changes
                if abs(newScore - trustScore) > 10 {
                    TrustHapticEngine.shared.trustGlowChange(intensity: newScore / 100.0)
                }
            }
    }

    private var glowColor: Color {
        if trustScore >= 80 {
            return .trustEmerald
        } else if trustScore >= 60 {
            return .trustAmber
        } else if trustScore >= 40 {
            return .trustIndigo
        } else {
            return .trustRose
        }
    }

    private var intensityMultiplier: Double {
        // Normalize to 0-1, with curve for better visual feedback
        let normalized = trustScore / 100.0

        // Apply easing curve (ease-in-out cubic)
        if normalized < 0.5 {
            return 4 * normalized * normalized * normalized
        } else {
            let t = 2 * normalized - 2
            return 1 + t * t * t / 2
        }
    }

    private var glowOpacity: Double {
        let baseOpacity = intensityMultiplier * 0.5
        let oscillation = sin(glowPhase * .pi * 2) * 0.1

        // Higher scores = more stable glow
        let stability = min(1.0, trustScore / 80.0)
        let oscillationAmount = oscillation * (1.0 - stability)

        return baseOpacity + oscillationAmount
    }

    private var animatedRadius: CGFloat {
        let baseRadius = radius * CGFloat(intensityMultiplier)
        let oscillation = sin(glowPhase * .pi * 2) * 8 * CGFloat(1.0 - min(1.0, trustScore / 80.0))
        return baseRadius + oscillation
    }

    private func startGlowAnimation() {
        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            glowPhase = 1.0
        }
    }
}

/// TrustScoreIndicator - Visual indicator showing trust score with glow
struct TrustScoreIndicator: View {
    let trustScore: Double
    let showLabel: Bool

    init(trustScore: Double, showLabel: Bool = true) {
        self.trustScore = max(0.0, min(100.0, trustScore))
        self.showLabel = showLabel
    }

    var body: some View {
        VStack(spacing: 8) {
            if showLabel {
                Text("Trust Score")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            ZStack {
                // Background circle
                Circle()
                    .stroke(Color.walletTextSecondary.opacity(0.2), lineWidth: 8)
                    .frame(width: 80, height: 80)

                // Progress circle
                Circle()
                    .trim(from: 0, to: CGFloat(trustScore / 100.0))
                    .stroke(
                        scoreColor,
                        style: StrokeStyle(lineWidth: 8, lineCap: .round)
                    )
                    .frame(width: 80, height: 80)
                    .rotationEffect(.degrees(-90))
                    .animation(TrustMotionConfig.smoothSpring, value: trustScore)

                // Score text
                Text("\(Int(trustScore))")
                    .font(WalletTypography.title2)
                    .fontWeight(.bold)
                    .foregroundColor(scoreColor)
            }
        }
        .modifier(TrustGlowIntensity(trustScore: trustScore, radius: 15))
    }

    private var scoreColor: Color {
        if trustScore >= 80 {
            return .trustEmerald
        } else if trustScore >= 60 {
            return .trustAmber
        } else {
            return .trustRose
        }
    }
}

extension View {
    /// Links trust glow intensity directly to trust score (0-100)
    func trustGlowIntensity(score: Double, radius: CGFloat = 20) -> some View {
        modifier(TrustGlowIntensity(trustScore: score, radius: radius))
    }
}

