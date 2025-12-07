//
//  IdentityCapsule.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 6
//  "Your Identity" top capsule component
//

import SwiftUI

struct IdentityCapsule: View {
    @EnvironmentObject var appState: AppStateContainer
    var onTap: (() -> Void)? = nil

    var body: some View {
        Button(action: {
            onTap?()
        }) {
            HStack(spacing: WalletSpacing.sm) {
                // Identity orb (animated)
                IdentityOrb(size: 40)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text("Your Identity")
                        .font(VitalCVFonts.subheadline)
                        .foregroundColor(.walletTextSecondary)

                    if let did = appState.currentUserDid {
                        Text(did)
                            .font(VitalCVFonts.monospaceSmall)
                            .foregroundColor(.walletText)
                            .lineLimit(1)
                    } else {
                        Text("Not set up")
                            .font(VitalCVFonts.caption1)
                            .foregroundColor(.walletTextSecondary)
                    }
                }

                Spacer()

                VitalCVIcon(
                    systemName: VitalCVIcons.Navigation.forward,
                    size: 16,
                    color: .walletTextSecondary
                )
            }
            .padding(WalletSpacing.md)
            .background(
                Capsule()
                    .fill(Color.walletCard)
                    .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

/// Animated identity orb
struct IdentityOrb: View {
    var size: CGFloat = 40
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.walletPrimary, .walletSecondary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.3), lineWidth: 2)
                )
                .shadow(color: .walletPrimary.opacity(0.3), radius: 8, x: 0, y: 4)

            // Pulse animation
            Circle()
                .fill(Color.walletPrimary.opacity(0.2))
                .frame(width: size, height: size)
                .scaleEffect(isAnimating ? 1.3 : 1.0)
                .opacity(isAnimating ? 0 : 1)
                .animation(
                    Animation.easeOut(duration: 2)
                        .repeatForever(autoreverses: false),
                    value: isAnimating
                )
        }
        .onAppear {
            isAnimating = true
        }
    }
}

