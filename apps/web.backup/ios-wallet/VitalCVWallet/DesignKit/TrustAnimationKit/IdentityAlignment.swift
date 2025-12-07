//
//  IdentityAlignment.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 38
//  Identity alignment animation when a new credential joins
//

import SwiftUI

/// IdentityAlignment - Alignment animation when credential joins
struct IdentityAlignment: View {
    let credentials: [CredentialInfo]
    @State private var alignmentPhase: Double = 0.0

    struct CredentialInfo: Identifiable {
        let id: UUID
        let title: String
        let isNew: Bool
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(Array(credentials.enumerated()), id: \.element.id) { index, credential in
                    CredentialOrb(
                        credential: credential,
                        index: index,
                        total: credentials.count,
                        geometry: geometry.size
                    )
                    .offset(alignmentOffset(for: index, in: geometry.size))
                }
            }
            .onAppear {
                startAlignment()
            }
        }
    }

    private func alignmentOffset(for index: Int, in size: CGSize) -> CGSize {
        let angle = Double(index) * (2 * .pi / Double(credentials.count))
        let radius = min(size.width, size.height) * 0.3
        let centerX = size.width / 2
        let centerY = size.height / 2

        // Base position
        let baseX = centerX + cos(angle) * radius
        let baseY = centerY + sin(angle) * radius

        // Alignment animation
        let alignmentAmount = sin(alignmentPhase * .pi * 2) * 10
        let alignedX = baseX + cos(angle) * alignmentAmount
        let alignedY = baseY + sin(angle) * alignmentAmount

        return CGSize(
            width: alignedX - centerX,
            height: alignedY - centerY
        )
    }

    private func startAlignment() {
        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            alignmentPhase = 1.0
        }

        // Initial alignment pulse
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            TrustHapticEngine.shared.verificationSuccess()
        }
    }
}

struct CredentialOrb: View {
    let credential: IdentityAlignment.CredentialInfo
    let index: Int
    let total: Int
    let geometry: CGSize

    @State private var orbScale: CGFloat = 1.0
    @State private var orbGlow: Double = 0.5

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            orbColor.opacity(0.9),
                            orbColor.opacity(0.6)
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: 30
                    )
                )
                .frame(width: 60, height: 60)
                .scaleEffect(orbScale)
                .shadow(
                    color: orbColor.opacity(orbGlow),
                    radius: 15,
                    x: 0,
                    y: 0
                )

            Text(credential.title.prefix(1))
                .font(WalletTypography.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
        }
        .onAppear {
            if credential.isNew {
                animateNewCredential()
            }
        }
    }

    private var orbColor: Color {
        credential.isNew ? .trustEmerald : .trustIndigo
    }

    private func animateNewCredential() {
        // Initial pulse
        withAnimation(.easeOut(duration: 0.3)) {
            orbScale = 1.5
            orbGlow = 0.8
        }

        // Settle
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(TrustMotionConfig.bouncySpring) {
                orbScale = 1.0
                orbGlow = 0.5
            }
        }

        // Continuous pulse
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            withAnimation(
                Animation.easeInOut(duration: 2.0)
                    .repeatForever(autoreverses: true)
            ) {
                orbGlow = 0.7
            }
        }
    }
}

extension View {
    /// Adds identity alignment animation when credential joins
    func identityAlignment(credentials: [IdentityAlignment.CredentialInfo]) -> some View {
        overlay(
            IdentityAlignment(credentials: credentials)
                .allowsHitTesting(false)
        )
    }
}

