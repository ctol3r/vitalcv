//
//  MultiLayerTrustHalo.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 21
//  Multi-layer trust halo around primary credential
//

import SwiftUI

/// MultiLayerTrustHalo - Multi-layer glowing halo effect around credentials
struct MultiLayerTrustHalo: ViewModifier {
    let trustScore: Double
    var intensity: Double = 1.0

    @State private var pulsePhase: Double = 0

    private var haloColor: Color {
        if trustScore >= 0.8 {
            return .walletSuccess
        } else if trustScore >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    func body(content: Content) -> some View {
        content
            .overlay(
                ZStack {
                    // Outer halo layer
                    Circle()
                        .stroke(
                            haloColor.opacity(0.3 * intensity),
                            lineWidth: 2
                        )
                        .frame(width: 200, height: 200)
                        .blur(radius: 10)
                        .scaleEffect(1.0 + sin(pulsePhase) * 0.1)

                    // Middle halo layer
                    Circle()
                        .stroke(
                            haloColor.opacity(0.5 * intensity),
                            lineWidth: 3
                        )
                        .frame(width: 180, height: 180)
                        .blur(radius: 8)
                        .scaleEffect(1.0 + sin(pulsePhase + .pi / 3) * 0.08)

                    // Inner halo layer
                    Circle()
                        .stroke(
                            haloColor.opacity(0.7 * intensity),
                            lineWidth: 4
                        )
                        .frame(width: 160, height: 160)
                        .blur(radius: 6)
                        .scaleEffect(1.0 + sin(pulsePhase + .pi * 2 / 3) * 0.06)
                }
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 3.0)
                        .repeatForever(autoreverses: false)
                ) {
                    pulsePhase = .pi * 2
                }
            }
    }
}

extension View {
    /// Apply multi-layer trust halo effect
    func multiLayerTrustHalo(trustScore: Double, intensity: Double = 1.0) -> some View {
        modifier(MultiLayerTrustHalo(trustScore: trustScore, intensity: intensity))
    }
}

#Preview {
    Circle()
        .fill(Color.walletPrimary)
        .frame(width: 100, height: 100)
        .multiLayerTrustHalo(trustScore: 0.85)
}

