//
//  ProofRipple.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 37
//  Proof ripple emanating from verified credential card
//

import SwiftUI

/// ProofRipple - Ripple effect emanating from verified credential
struct ProofRipple: View {
    let isVerified: Bool
    let rippleCount: Int
    @State private var ripples: [RippleState] = []

    struct RippleState: Identifiable {
        let id: UUID
        var scale: CGFloat
        var opacity: Double
    }

    init(isVerified: Bool, rippleCount: Int = 4) {
        self.isVerified = isVerified
        self.rippleCount = rippleCount
    }

    var body: some View {
        ZStack {
            ForEach(ripples) { ripple in
                Circle()
                    .stroke(
                        Color.trustEmerald.opacity(ripple.opacity),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                    .frame(width: 200, height: 200)
                    .scaleEffect(ripple.scale)
            }
        }
        .onChange(of: isVerified) { verified in
            if verified {
                generateRipples()
            }
        }
    }

    private func generateRipples() {
        ripples.removeAll()

        for i in 0..<rippleCount {
            let ripple = RippleState(
                id: UUID(),
                scale: 0.3,
                opacity: 0.8
            )

            ripples.append(ripple)

            // Animate ripple with delay
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.2) {
                animateRipple(id: ripple.id)
            }
        }

        TrustHapticEngine.shared.verificationSuccess()
    }

    private func animateRipple(id: UUID) {
        guard let index = ripples.firstIndex(where: { $0.id == id }) else { return }

        withAnimation(
            Animation.easeOut(duration: 1.5)
        ) {
            ripples[index].scale = 2.5
            ripples[index].opacity = 0.0
        }
    }
}

/// VerifiedCredentialCard - Card with proof ripple
struct VerifiedCredentialCard: View {
    let credential: CredentialInfo
    @State private var isVerified = false

    struct CredentialInfo: Identifiable {
        let id: UUID
        let title: String
        let issuer: String
        let trustScore: Double
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(credential.title)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text(credential.issuer)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                if isVerified {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(.trustEmerald)
                        .font(.system(size: 24))
                        .transition(.scale.combined(with: .opacity))
                }
            }

            TrustScoreIndicator(trustScore: credential.trustScore, showLabel: false)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
        .overlay(
            ProofRipple(isVerified: isVerified, rippleCount: 4)
                .allowsHitTesting(false)
        )
        .onAppear {
            // Trigger verification after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                withAnimation(TrustMotionConfig.smoothSpring) {
                    isVerified = true
                }
            }
        }
    }
}

extension View {
    /// Adds proof ripple (emanating from verified credential)
    func proofRipple(isVerified: Bool, count: Int = 4) -> some View {
        overlay(
            ProofRipple(isVerified: isVerified, rippleCount: count)
                .allowsHitTesting(false)
        )
    }
}

