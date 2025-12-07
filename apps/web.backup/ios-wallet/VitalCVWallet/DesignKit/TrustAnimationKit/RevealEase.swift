//
//  RevealEase.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 30
//  Reveal ease for SD-JWT field reveal
//

import SwiftUI

/// RevealEase - Smooth reveal animation for SD-JWT fields
struct RevealEase: ViewModifier {
    let isRevealed: Bool
    @State private var revealProgress: Double = 0.0

    func body(content: Content) -> some View {
        content
            .opacity(revealProgress)
            .offset(y: (1.0 - revealProgress) * 10)
            .blur(radius: (1.0 - revealProgress) * 5)
            .onChange(of: isRevealed) { revealed in
                animateReveal(revealed: revealed)
            }
            .onAppear {
                if isRevealed {
                    revealProgress = 1.0
                }
            }
    }

    private func animateReveal(revealed: Bool) {
        withAnimation(TrustMotionConfig.smoothSpring) {
            revealProgress = revealed ? 1.0 : 0.0
        }

        if revealed {
            TrustHapticEngine.shared.stepCompleted()
            TrustTickSound.shared.playTick()
        }
    }
}

/// SDJWTFieldView - Field with reveal animation
struct SDJWTFieldView: View {
    let label: String
    let value: String
    let isHidden: Bool
    @State private var isRevealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(label)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)

                Spacer()

                if isHidden && !isRevealed {
                    Button(action: {
                        isRevealed = true
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "eye.slash.fill")
                                .font(.system(size: 12))
                            Text("Reveal")
                                .font(WalletTypography.caption)
                        }
                        .foregroundColor(.trustIndigo)
                    }
                }
            }

            if !isHidden || isRevealed {
                Text(isHidden ? "••••••••" : value)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletText)
                    .modifier(RevealEase(isRevealed: isRevealed || !isHidden))
            } else {
                Text("••••••••")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.walletCard)
        )
    }
}

/// SelectionDissolve - Dissolve animation for selections
struct SelectionDissolve: ViewModifier {
    let isSelected: Bool
    @State private var selectionProgress: Double = 0.0

    func body(content: Content) -> some View {
        content
            .scaleEffect(1.0 + (isSelected ? 0.05 : 0.0))
            .opacity(0.7 + (selectionProgress * 0.3))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(
                        isSelected ? Color.trustEmerald.opacity(selectionProgress) : Color.clear,
                        lineWidth: 2
                    )
            )
            .onChange(of: isSelected) { selected in
                animateSelection(selected: selected)
            }
    }

    private func animateSelection(selected: Bool) {
        withAnimation(TrustMotionConfig.responsiveSpring) {
            selectionProgress = selected ? 1.0 : 0.0
        }

        if selected {
            TrustHapticEngine.shared.stepCompleted()
        }
    }
}

extension View {
    /// Adds reveal ease animation for SD-JWT fields
    func revealEase(isRevealed: Bool) -> some View {
        modifier(RevealEase(isRevealed: isRevealed))
    }

    /// Adds selection dissolve animation
    func selectionDissolve(isSelected: Bool) -> some View {
        modifier(SelectionDissolve(isSelected: isSelected))
    }
}

