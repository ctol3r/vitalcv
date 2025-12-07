//
//  BlockLightHighlight.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 21
//  Block light highlight on tapping "View On-Chain"
//

import SwiftUI

/// BlockLightHighlight - Highlight animation when viewing on-chain
struct BlockLightHighlight: View {
    let blockHash: String
    @State private var highlightPhase: Double = 0.0
    @State private var isHighlighted = false

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.walletCard)
                    .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)

                // Highlight overlay
                if isHighlighted {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.trustEmerald.opacity(highlightOpacity),
                                    Color.trustIndigo.opacity(highlightOpacity * 0.5),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .blur(radius: 20)
                }

                // Content
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "cube.fill")
                            .foregroundColor(.trustEmerald)

                        Text("Block")
                            .font(WalletTypography.headline)
                            .foregroundColor(.walletText)

                        Spacer()

                        if isHighlighted {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.trustEmerald)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }

                    Text(blockHash)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                        .lineLimit(1)
                }
                .padding(16)
            }
        }
        .onTapGesture {
            highlight()
        }
    }

    private var highlightOpacity: Double {
        let baseOpacity = 0.3
        let pulseAmount = sin(highlightPhase * .pi * 2) * 0.1
        return baseOpacity + pulseAmount
    }

    private func highlight() {
        isHighlighted = true
        TrustHapticEngine.shared.chainConfirmed()

        // Pulse animation
        withAnimation(
            Animation.easeInOut(duration: 0.6)
                .repeatCount(2, autoreverses: true)
        ) {
            highlightPhase = 1.0
        }

        // Settle
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation(TrustMotionConfig.smoothSpring) {
                highlightPhase = 0.0
            }
        }
    }
}

/// OnChainViewButton - Button with light highlight animation
struct OnChainViewButton: View {
    let blockHash: String
    let action: () -> Void
    @State private var isPressed = false
    @State private var highlightScale: CGFloat = 1.0

    var body: some View {
        Button(action: {
            action()
            triggerHighlight()
        }) {
            HStack(spacing: 8) {
                Image(systemName: "link.circle.fill")
                    .font(.system(size: 18))

                Text("View On-Chain")
                    .font(WalletTypography.headline)
            }
            .foregroundColor(.trustEmerald)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(
                Capsule()
                    .fill(Color.trustEmerald.opacity(0.1))
                    .overlay(
                        Capsule()
                            .stroke(
                                Color.trustEmerald.opacity(0.3),
                                lineWidth: 1
                            )
                    )
            )
            .scaleEffect(highlightScale)
            .shadow(
                color: isPressed ? Color.trustEmerald.opacity(0.5) : .clear,
                radius: isPressed ? 15 : 0,
                x: 0,
                y: 0
            )
        }
        .buttonStyle(PlainButtonStyle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressed {
                        isPressed = true
                        withAnimation(.easeOut(duration: 0.1)) {
                            highlightScale = 0.95
                        }
                    }
                }
                .onEnded { _ in
                    isPressed = false
                    withAnimation(.easeOut(duration: 0.1)) {
                        highlightScale = 1.0
                    }
                }
        )
    }

    private func triggerHighlight() {
        withAnimation(
            Animation.easeOut(duration: 0.3)
        ) {
            highlightScale = 1.1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(TrustMotionConfig.smoothSpring) {
                highlightScale = 1.0
            }
        }
    }
}

extension View {
    /// Adds block light highlight on tap
    func blockLightHighlight(blockHash: String) -> some View {
        overlay(
            BlockLightHighlight(blockHash: blockHash)
                .allowsHitTesting(false)
        )
    }
}

