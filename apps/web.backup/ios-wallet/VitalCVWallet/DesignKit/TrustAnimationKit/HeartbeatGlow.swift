//
//  HeartbeatGlow.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 32
//  Persistent "heartbeat glow" for primary credential
//

import SwiftUI

/// HeartbeatGlow - Persistent heartbeat glow for primary credential
struct HeartbeatGlow: ViewModifier {
    let frequency: Double // Beats per second
    let intensity: Double

    @State private var heartbeatPhase: Double = 0.0
    @State private var glowRadius: CGFloat = 15
    @State private var glowOpacity: Double = 0.3

    init(frequency: Double = 1.0, intensity: Double = 0.6) {
        self.frequency = frequency
        self.intensity = intensity
    }

    func body(content: Content) -> some View {
        content
            .shadow(
                color: Color.trustEmerald.opacity(glowOpacity),
                radius: glowRadius,
                x: 0,
                y: 0
            )
            .overlay(
                content
                    .blur(radius: glowRadius * 0.5)
                    .opacity(glowOpacity * 0.3)
                    .blendMode(.overlay)
            )
            .onAppear {
                startHeartbeat()
            }
    }

    private func startHeartbeat() {
        // Heartbeat pattern: double beat
        Timer.scheduledTimer(withTimeInterval: 1.0 / frequency, repeats: true) { _ in
            // First beat
            withAnimation(.easeOut(duration: 0.15)) {
                glowRadius = 25
                glowOpacity = intensity * 0.6
            }

            // First beat fade
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                withAnimation(.easeIn(duration: 0.2)) {
                    glowRadius = 18
                    glowOpacity = intensity * 0.4
                }
            }

            // Second beat
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                withAnimation(.easeOut(duration: 0.15)) {
                    glowRadius = 22
                    glowOpacity = intensity * 0.5
                }
            }

            // Settle
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                withAnimation(.easeInOut(duration: 0.3)) {
                    glowRadius = 15
                    glowOpacity = intensity * 0.3
                }
            }
        }

        // Continuous phase animation
        withAnimation(
            Animation.easeInOut(duration: 2.0)
                .repeatForever(autoreverses: true)
        ) {
            heartbeatPhase = 1.0
        }
    }
}

/// PrimaryCredentialCard - Card with heartbeat glow
struct PrimaryCredentialCard: View {
    let credential: CredentialInfo
    let isPrimary: Bool

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

                if isPrimary {
                    Image(systemName: "heart.fill")
                        .foregroundColor(.trustEmerald)
                        .font(.system(size: 20))
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
        .modifier(HeartbeatGlow(frequency: isPrimary ? 1.0 : 0, intensity: isPrimary ? 0.6 : 0))
    }
}

extension View {
    /// Adds persistent heartbeat glow for primary credential
    func heartbeatGlow(frequency: Double = 1.0, intensity: Double = 0.6) -> some View {
        modifier(HeartbeatGlow(frequency: frequency, intensity: intensity))
    }
}

