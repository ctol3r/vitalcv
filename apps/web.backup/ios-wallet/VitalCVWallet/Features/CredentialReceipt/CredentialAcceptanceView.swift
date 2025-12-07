//
//  CredentialAcceptanceView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 28
//  Credential acceptance animation
//

import SwiftUI

struct CredentialAcceptanceView: View {
    let credential: VerifiableCredential
    @State private var isAnimating = false
    @State private var showSuccess = false
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.walletBackground
                .ignoresSafeArea()

            VStack(spacing: WalletSpacing.xl) {
                if !showSuccess {
                    // Acceptance animation
                    VStack(spacing: WalletSpacing.lg) {
                        ZStack {
                            Circle()
                                .fill(Color.walletPrimary.opacity(0.2))
                                .frame(width: 200, height: 200)
                                .scaleEffect(isAnimating ? 1.2 : 1.0)
                                .opacity(isAnimating ? 0.0 : 1.0)

                            Circle()
                                .fill(Color.walletPrimary.opacity(0.3))
                                .frame(width: 150, height: 150)
                                .scaleEffect(isAnimating ? 1.3 : 1.0)
                                .opacity(isAnimating ? 0.0 : 1.0)

                            Image(systemName: "doc.badge.plus")
                                .font(.system(size: 64))
                                .foregroundColor(.walletPrimary)
                        }

                        Text("Accepting Credential...")
                            .font(WalletTypography.title2)
                            .foregroundColor(.walletText)
                    }
                } else {
                    // Success state
                    VStack(spacing: WalletSpacing.lg) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 80))
                            .foregroundColor(.walletSuccess)

                        Text("Credential Added!")
                            .font(WalletTypography.largeTitle)
                            .foregroundColor(.walletText)

                        Text(credential.type.first ?? "Credential")
                            .font(WalletTypography.title3)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }
        }
        .onAppear {
            startAnimation()
        }
    }

    private func startAnimation() {
        withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: false)) {
            isAnimating = true
        }

        // Simulate acceptance process
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds

            await MainActor.run {
                withAnimation {
                    showSuccess = true
                }

                // Accept credential
                Task {
                    await OIDC4VCIService.shared.acceptCredential(credential: credential)
                }

                // Haptic feedback
                HapticFeedbackService.shared.verificationSuccess()

                // Dismiss after delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    dismiss()
                }
            }
        }
    }
}








