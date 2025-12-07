//
//  AnchorPulse.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 18
//  Anchor pulse synchronized to chain confirmation count
//

import SwiftUI

/// AnchorPulse - Pulse synchronized to chain confirmation count
struct AnchorPulse: View {
    let confirmationCount: Int
    @State private var pulsePhase: Double = 0.0
    @State private var pulseIntensity: Double = 0.5

    var body: some View {
        ZStack {
            // Anchor icon
            Image(systemName: "link.circle.fill")
                .font(.system(size: 40, weight: .semibold))
                .foregroundColor(pulseColor)
                .scaleEffect(pulseScale)

            // Pulse rings
            ForEach(0..<pulseRingCount, id: \.self) { index in
                Circle()
                    .stroke(
                        pulseColor.opacity(pulseOpacity(for: index)),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round)
                    )
                    .frame(width: 80, height: 80)
                    .scaleEffect(pulseScale(for: index))
            }
        }
        .onAppear {
            startPulse()
        }
        .onChange(of: confirmationCount) { newCount in
            updatePulseForCount(newCount)
        }
    }

    private var pulseRingCount: Int {
        min(confirmationCount, 3)
    }

    private var pulseColor: Color {
        if confirmationCount >= 3 {
            return .trustEmerald
        } else if confirmationCount >= 1 {
            return .trustAmber
        } else {
            return .trustIndigo
        }
    }

    private var basePulseScale: CGFloat {
        let base: CGFloat = 1.0
        let pulseAmount = sin(pulsePhase * .pi * 2) * CGFloat(pulseIntensity * 0.15)
        return base + pulseAmount
    }

    private func pulseScale(for index: Int) -> CGFloat {
        let delay = Double(index) * 0.3
        let adjustedPhase = pulsePhase - delay
        let pulseAmount = sin(adjustedPhase * .pi * 2) * CGFloat(pulseIntensity * 0.2)
        return basePulseScale + pulseAmount
    }

    private func pulseOpacity(for index: Int) -> Double {
        let delay = Double(index) * 0.3
        let adjustedPhase = pulsePhase - delay
        let baseOpacity = 0.6 - (Double(index) * 0.15)
        let pulseAmount = (sin(adjustedPhase * .pi * 2) + 1) * 0.5 * 0.3
        return baseOpacity + pulseAmount
    }

    private var pulseScale: CGFloat {
        basePulseScale
    }

    private func startPulse() {
        withAnimation(
            Animation.easeInOut(duration: 1.0)
                .repeatForever(autoreverses: true)
        ) {
            pulsePhase = 1.0
        }
    }

    private func updatePulseForCount(_ count: Int) {
        // Increase pulse intensity with more confirmations
        withAnimation(TrustMotionConfig.smoothSpring) {
            pulseIntensity = min(1.0, Double(count) / 3.0)
        }

        // Haptic feedback
        if count > 0 && count % 3 == 0 {
            TrustHapticEngine.shared.chainConfirmed()
        }
    }
}

/// AnchorConfirmationIndicator - Visual indicator for confirmations
struct AnchorConfirmationIndicator: View {
    let confirmationCount: Int
    let totalConfirmations: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<totalConfirmations, id: \.self) { index in
                Circle()
                    .fill(index < confirmationCount ? .trustEmerald : .walletTextSecondary.opacity(0.3))
                    .frame(width: 8, height: 8)
                    .scaleEffect(index < confirmationCount ? 1.2 : 1.0)
                    .animation(
                        TrustMotionConfig.responsiveSpring.delay(Double(index) * 0.1),
                        value: confirmationCount
                    )
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color.walletCard.opacity(0.8))
                .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
        )
    }
}

extension View {
    /// Adds anchor pulse synchronized to confirmation count
    func anchorPulse(confirmationCount: Int) -> some View {
        overlay(
            AnchorPulse(confirmationCount: confirmationCount)
                .allowsHitTesting(false)
        )
    }
}

