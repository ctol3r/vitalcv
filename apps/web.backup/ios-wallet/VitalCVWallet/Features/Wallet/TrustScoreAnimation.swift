//
//  TrustScoreAnimation.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 23
//  Soft animation for trust-score updates
//

import SwiftUI

/// TrustScoreAnimation - Animated trust score updates
struct TrustScoreAnimation: ViewModifier {
    @State private var previousScore: Double?
    @State private var animatedScore: Double
    let currentScore: Double?

    init(currentScore: Double?) {
        self.currentScore = currentScore
        self._animatedScore = State(initialValue: currentScore ?? 0)
    }

    func body(content: Content) -> some View {
        content
            .onChange(of: currentScore) { newScore in
                guard let newScore = newScore else { return }

                // Task 23: Soft animation for trust-score updates
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    animatedScore = newScore
                }
            }
    }
}

extension View {
    func animateTrustScore(_ score: Double?) -> some View {
        modifier(TrustScoreAnimation(currentScore: score))
    }
}

/// Shimmer effect for new credentials (Task 24)
struct NewCredentialShimmer: ViewModifier {
    @State private var isAnimating = false
    let isNew: Bool

    func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if isNew && isAnimating {
                        LinearGradient(
                            colors: [
                                Color.clear,
                                Color.white.opacity(0.3),
                                Color.clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .offset(x: isAnimating ? 200 : -200)
                        .animation(
                            Animation.linear(duration: 1.5)
                                .repeatForever(autoreverses: false),
                            value: isAnimating
                        )
                    }
                }
            )
            .onAppear {
                if isNew {
                    isAnimating = true
                }
            }
    }
}

extension View {
    func shimmerIfNew(isNew: Bool) -> some View {
        modifier(NewCredentialShimmer(isNew: isNew))
    }
}

