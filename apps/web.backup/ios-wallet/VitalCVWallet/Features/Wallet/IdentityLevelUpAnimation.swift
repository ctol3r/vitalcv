//
//  IdentityLevelUpAnimation.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 25
//  Identity level-up animation when adding new credentials
//

import SwiftUI

/// IdentityLevelUpAnimation - Celebration animation when credentials are added
struct IdentityLevelUpAnimation: View {
    @Binding var isPresented: Bool
    let newCredentialCount: Int
    let totalCredentials: Int

    @State private var scale: CGFloat = 0.5
    @State private var rotation: Double = 0
    @State private var particleOffset: CGFloat = 0
    @State private var glowIntensity: Double = 0

    private var level: Int {
        totalCredentials / 5 + 1 // Level up every 5 credentials
    }

    var body: some View {
        if isPresented {
            ZStack {
                // Background overlay
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture {
                        dismiss()
                    }

                // Main animation
                VStack(spacing: WalletSpacing.xl) {
                    // Level badge
                    ZStack {
                        // Glow effect
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        Color.walletPrimary.opacity(glowIntensity * 0.5),
                                        Color.walletPrimary.opacity(0)
                                    ],
                                    center: .center,
                                    startRadius: 50,
                                    endRadius: 150
                                )
                            )
                            .frame(width: 200, height: 200)
                            .blur(radius: 20)

                        // Level circle
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.walletPrimary,
                                        Color.walletSecondary
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 120, height: 120)
                            .overlay(
                                VStack(spacing: 4) {
                                    Text("LVL")
                                        .font(WalletTypography.caption)
                                        .foregroundColor(.white.opacity(0.8))

                                    Text("\(level)")
                                        .font(.system(size: 48, weight: .bold, design: .rounded))
                                        .foregroundColor(.white)
                                }
                            )
                            .scaleEffect(scale)
                            .rotationEffect(.degrees(rotation))
                            .shadow(color: Color.walletPrimary.opacity(0.5), radius: 20, x: 0, y: 10)
                    }

                    // Title
                    VStack(spacing: WalletSpacing.sm) {
                        Text("Level Up!")
                            .font(WalletTypography.largeTitle)
                            .foregroundColor(.white)
                            .bold()

                        Text("\(newCredentialCount) new credential\(newCredentialCount == 1 ? "" : "s") added")
                            .font(WalletTypography.headline)
                            .foregroundColor(.white.opacity(0.9))

                        Text("Total: \(totalCredentials) credentials")
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.white.opacity(0.7))
                    }
                    .opacity(scale > 0.8 ? 1 : 0)

                    // Particles
                    ParticleBurst(count: 20, offset: particleOffset)
                }
            }
            .onAppear {
                startAnimation()
            }
        }
    }

    private func startAnimation() {
        // Scale up animation
        withAnimation(.spring(response: 0.6, dampingFraction: 0.6)) {
            scale = 1.0
        }

        // Rotation animation
        withAnimation(.linear(duration: 1.0).repeatCount(2, autoreverses: false)) {
            rotation = 360
        }

        // Glow pulse
        withAnimation(.easeInOut(duration: 0.8).repeatCount(3, autoreverses: true)) {
            glowIntensity = 1.0
        }

        // Particle burst
        withAnimation(.easeOut(duration: 1.5)) {
            particleOffset = 200
        }

        // Haptic feedback
        HapticFeedbackService.shared.play(.success)

        // Auto-dismiss after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            dismiss()
        }
    }

    private func dismiss() {
        withAnimation(.easeOut(duration: 0.3)) {
            isPresented = false
        }
    }
}

// MARK: - Particle Burst

struct ParticleBurst: View {
    let count: Int
    let offset: CGFloat

    var body: some View {
        ZStack {
            ForEach(0..<count, id: \.self) { index in
                Circle()
                    .fill(
                        Color.walletPrimary.opacity(0.8)
                    )
                    .frame(width: 8, height: 8)
                    .offset(
                        x: cos(Double(index) * 2 * .pi / Double(count)) * offset,
                        y: sin(Double(index) * 2 * .pi / Double(count)) * offset
                    )
                    .opacity(offset > 0 ? max(0, 1 - offset / 200) : 1)
            }
        }
    }
}

// MARK: - Level Up Modifier

struct LevelUpModifier: ViewModifier {
    @Binding var isPresented: Bool
    let newCredentialCount: Int
    let totalCredentials: Int

    func body(content: Content) -> some View {
        content
            .overlay {
                IdentityLevelUpAnimation(
                    isPresented: $isPresented,
                    newCredentialCount: newCredentialCount,
                    totalCredentials: totalCredentials
                )
            }
    }
}

extension View {
    /// Show level-up animation when credentials are added
    func levelUpAnimation(
        isPresented: Binding<Bool>,
        newCredentialCount: Int,
        totalCredentials: Int
    ) -> some View {
        modifier(
            LevelUpModifier(
                isPresented: isPresented,
                newCredentialCount: newCredentialCount,
                totalCredentials: totalCredentials
            )
        )
    }
}

#Preview {
    IdentityLevelUpAnimation(
        isPresented: .constant(true),
        newCredentialCount: 3,
        totalCredentials: 15
    )
}

