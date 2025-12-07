//
//  AnchorSnap.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 22
//  Anchor snap animation when anchor verified
//

import SwiftUI

/// AnchorSnap - Snap animation when anchor is verified
struct AnchorSnap: View {
    let isVerified: Bool
    @State private var snapScale: CGFloat = 1.0
    @State private var snapRotation: Double = 0
    @State private var showCheckmark = false

    var body: some View {
        ZStack {
            // Anchor icon
            Image(systemName: "link.circle.fill")
                .font(.system(size: 50, weight: .semibold))
                .foregroundColor(iconColor)
                .scaleEffect(snapScale)
                .rotationEffect(.degrees(snapRotation))

            // Checkmark overlay
            if showCheckmark {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(.trustEmerald)
                    .offset(x: 20, y: -20)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .onChange(of: isVerified) { verified in
            if verified {
                triggerSnap()
            }
        }
    }

    private var iconColor: Color {
        isVerified ? .trustEmerald : .walletTextSecondary
    }

    private func triggerSnap() {
        // Snap animation sequence
        TrustHapticEngine.shared.chainAnchorSuccess()

        // Initial scale up
        withAnimation(
            Animation.easeOut(duration: 0.15)
        ) {
            snapScale = 1.3
            snapRotation = -10
        }

        // Snap back with overshoot
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(
                TrustMotionConfig.bouncySpring
            ) {
                snapScale = 1.0
                snapRotation = 0
            }
        }

        // Show checkmark
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(TrustMotionConfig.responsiveSpring) {
                showCheckmark = true
            }
        }

        // Pulse effect
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(
                Animation.easeInOut(duration: 0.2)
                    .repeatCount(2, autoreverses: true)
            ) {
                snapScale = 1.05
            }
        }
    }
}

/// AnchorSnapCard - Card with snap animation
struct AnchorSnapCard: View {
    let anchorId: String
    let isVerified: Bool
    let timestamp: Date?
    @State private var cardScale: CGFloat = 1.0
    @State private var cardOffset: CGSize = .zero

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                AnchorSnap(isVerified: isVerified)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Anchor")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    if isVerified {
                        Text("Verified")
                            .font(WalletTypography.caption)
                            .foregroundColor(.trustEmerald)
                    } else {
                        Text("Pending")
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                }

                Spacer()
            }

            if let timestamp = timestamp {
                Text(formatTimestamp(timestamp))
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
        .scaleEffect(cardScale)
        .offset(cardOffset)
        .modifier(AnchorSnapModifier(isVerified: isVerified))
        .onChange(of: isVerified) { verified in
            if verified {
                triggerCardSnap()
            }
        }
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func triggerCardSnap() {
        // Quick snap motion
        withAnimation(.easeOut(duration: 0.1)) {
            cardOffset = CGSize(width: -5, height: 0)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(TrustMotionConfig.bouncySpring) {
                cardOffset = .zero
                cardScale = 1.02
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(TrustMotionConfig.smoothSpring) {
                cardScale = 1.0
            }
        }
    }
}

struct AnchorSnapModifier: ViewModifier {
    let isVerified: Bool

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isVerified ? Color.trustEmerald.opacity(0.5) : Color.clear,
                        lineWidth: 2
                    )
                    .shadow(
                        color: isVerified ? Color.trustEmerald.opacity(0.3) : .clear,
                        radius: 8,
                        x: 0,
                        y: 0
                    )
            )
    }
}

extension View {
    /// Adds anchor snap animation when verified
    func anchorSnap(isVerified: Bool) -> some View {
        overlay(
            AnchorSnap(isVerified: isVerified)
                .allowsHitTesting(false)
        )
    }
}

