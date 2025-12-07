//
//  ConfidenceSlide.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 31
//  Confidence slide animation on trust score updates
//

import SwiftUI

/// ConfidenceSlide - Slide animation for trust score updates
struct ConfidenceSlide: ViewModifier {
    let newScore: Double
    let previousScore: Double

    @State private var slideOffset: CGFloat = 0
    @State private var showChange: Bool = false

    func body(content: Content) -> some View {
        content
            .offset(x: slideOffset)
            .overlay(
                changeIndicator
                    .offset(x: slideOffset)
                    .opacity(showChange ? 1.0 : 0.0)
            )
            .onChange(of: newScore) { score in
                animateSlide(from: previousScore, to: score)
            }
    }

    private var changeIndicator: some View {
        HStack(spacing: 4) {
            Image(systemName: newScore > previousScore ? "arrow.up" : "arrow.down")
                .font(.system(size: 12, weight: .bold))
            Text("\(Int(abs(newScore - previousScore)))")
                .font(WalletTypography.caption)
        }
        .foregroundColor(newScore > previousScore ? .trustEmerald : .trustRose)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
        )
    }

    private func animateSlide(from oldScore: Double, to newScore: Double) {
        let isIncrease = newScore > oldScore
        let slideDistance: CGFloat = isIncrease ? -50 : 50

        // Slide out
        withAnimation(.easeOut(duration: 0.2)) {
            slideOffset = slideDistance
        }

        // Reset and slide in
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            slideOffset = -slideDistance

            withAnimation(TrustMotionConfig.smoothSpring) {
                slideOffset = 0
                showChange = true
            }
        }

        // Hide change indicator
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.easeOut(duration: 0.3)) {
                showChange = false
            }
        }

        // Haptic feedback
        if abs(newScore - oldScore) > 5 {
            if isIncrease {
                TrustHapticEngine.shared.trustScoreIncreased()
            } else {
                TrustHapticEngine.shared.trustScoreDecreased()
            }
        }
    }
}

/// TrustScoreSlideView - Complete slide view for trust score
struct TrustScoreSlideView: View {
    @State private var currentScore: Double = 0
    let targetScore: Double

    var body: some View {
        VStack(spacing: 12) {
            Text("Trust Score")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            Text("\(Int(currentScore))")
                .font(WalletTypography.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(scoreColor)
                .modifier(ConfidenceSlide(newScore: currentScore, previousScore: 0))
                .modifier(TrustGlowIntensity(trustScore: currentScore, radius: 20))

            ProgressView(value: currentScore, total: 100)
                .progressViewStyle(LinearProgressViewStyle(tint: scoreColor))
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
        .onAppear {
            animateToTarget()
        }
    }

    private var scoreColor: Color {
        if currentScore >= 80 {
            return .trustEmerald
        } else if currentScore >= 60 {
            return .trustAmber
        } else {
            return .trustRose
        }
    }

    private func animateToTarget() {
        let duration: Double = 2.0
        let steps = 60
        let stepDuration = duration / Double(steps)
        let scoreDelta = (targetScore - currentScore) / Double(steps)

        for i in 0..<steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * stepDuration) {
                let previousScore = currentScore
                currentScore = min(targetScore, currentScore + scoreDelta)

                // Haptic on milestone
                if Int(previousScore) % 10 != Int(currentScore) % 10 {
                    TrustHapticEngine.shared.stepCompleted()
                }
            }
        }
    }
}

extension View {
    /// Adds confidence slide animation on trust score updates
    func confidenceSlide(newScore: Double, previousScore: Double) -> some View {
        modifier(ConfidenceSlide(newScore: newScore, previousScore: previousScore))
    }
}

