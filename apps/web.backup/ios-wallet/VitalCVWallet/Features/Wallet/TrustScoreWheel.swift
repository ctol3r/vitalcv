//
//  TrustScoreWheel.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 22
//  Animated trust-score wheel
//

import SwiftUI

/// TrustScoreWheel - Animated wheel showing trust score
struct TrustScoreWheel: View {
    let trustScore: Double
    var size: CGFloat = 120
    var showLabel: Bool = true
    var animated: Bool = true

    @State private var animatedScore: Double = 0

    private var clampedScore: Double {
        max(0.0, min(1.0, trustScore))
    }

    private var scoreColor: Color {
        if clampedScore >= 0.8 {
            return .walletSuccess
        } else if clampedScore >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    private var scoreLabel: String {
        if clampedScore >= 0.95 {
            return "Excellent"
        } else if clampedScore >= 0.8 {
            return "High"
        } else if clampedScore >= 0.5 {
            return "Medium"
        } else {
            return "Low"
        }
    }

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                // Background circle
                Circle()
                    .stroke(Color.gray.opacity(0.2), lineWidth: 12)
                    .frame(width: size, height: size)

                // Progress arc
                Circle()
                    .trim(from: 0, to: animatedScore)
                    .stroke(
                        AngularGradient(
                            colors: gradientColors,
                            center: .center,
                            startAngle: .degrees(-90),
                            endAngle: .degrees(270)
                        ),
                        style: StrokeStyle(lineWidth: 12, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .frame(width: size, height: size)
                    .animation(
                        animated ? .spring(response: 0.8, dampingFraction: 0.6) : nil,
                        value: animatedScore
                    )

                // Center content
                VStack(spacing: 4) {
                    Text("\(Int(animatedScore * 100))")
                        .font(.system(size: size * 0.25, weight: .bold, design: .rounded))
                        .foregroundColor(scoreColor)

                    if showLabel {
                        Text(scoreLabel)
                            .font(.system(size: size * 0.12, weight: .medium))
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }
        }
        .onAppear {
            if animated {
                withAnimation {
                    animatedScore = clampedScore
                }
            } else {
                animatedScore = clampedScore
            }
        }
        .onChange(of: trustScore) { newValue in
            if animated {
                withAnimation {
                    animatedScore = max(0.0, min(1.0, newValue))
                }
            } else {
                animatedScore = max(0.0, min(1.0, newValue))
            }
        }
    }

    private var gradientColors: [Color] {
        switch scoreColor {
        case .walletSuccess:
            return [
                Color.walletSuccess,
                Color.walletSuccess.opacity(0.8),
                Color.walletSuccess.opacity(0.6)
            ]
        case .walletWarning:
            return [
                Color.walletWarning,
                Color.walletWarning.opacity(0.8),
                Color.walletWarning.opacity(0.6)
            ]
        case .walletError:
            return [
                Color.walletError,
                Color.walletError.opacity(0.8),
                Color.walletError.opacity(0.6)
            ]
        default:
            return [Color.gray]
        }
    }
}

// MARK: - Compact Trust Score Wheel

struct CompactTrustScoreWheel: View {
    let trustScore: Double
    var size: CGFloat = 60

    var body: some View {
        TrustScoreWheel(
            trustScore: trustScore,
            size: size,
            showLabel: false,
            animated: true
        )
    }
}








