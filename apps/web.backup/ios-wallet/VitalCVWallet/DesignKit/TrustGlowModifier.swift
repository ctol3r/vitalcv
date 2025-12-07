//
//  TrustGlowModifier.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 10
//  Trust-glow modifier for card edges
//

import SwiftUI

/// Trust glow modifier - adds animated glow to card edges based on trust score
struct TrustGlowModifier: ViewModifier {
    let trustScore: Double?
    @State private var glowPhase: Double = 0

    init(trustScore: Double?) {
        self.trustScore = trustScore
    }

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        trustGlowColor.opacity(glowIntensity),
                        lineWidth: 2
                    )
                    .shadow(
                        color: trustGlowColor.opacity(glowIntensity * 0.5),
                        radius: 8,
                        x: 0,
                        y: 0
                    )
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 2.0)
                        .repeatForever(autoreverses: true)
                ) {
                    glowPhase = 1.0
                }
            }
    }

    private var trustGlowColor: Color {
        guard let score = trustScore else { return .walletTextSecondary }

        if score >= 0.8 {
            return .walletSuccess
        } else if score >= 0.6 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    private var glowIntensity: Double {
        guard let score = trustScore else { return 0.0 }

        // Animate between 0.3 and 0.7 based on trust score
        let baseIntensity = 0.3 + (score * 0.4)
        return baseIntensity + (sin(glowPhase * .pi * 2) * 0.1)
    }
}

extension View {
    func trustGlow(trustScore: Double?) -> some View {
        modifier(TrustGlowModifier(trustScore: trustScore))
    }
}

