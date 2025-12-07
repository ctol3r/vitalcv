//
//  NotificationGlowModifier.swift
//  VitalCVWallet
//
//  Created: Notifications 2.0 - Phase 3
//  Visual notification animations and glow effects
//

import SwiftUI

// MARK: - Notification Glow Modifier

struct NotificationGlowModifier: ViewModifier {
    let color: Color
    let intensity: Double
    let isActive: Bool

    @State private var glowPhase: Double = 0.0

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        LinearGradient(
                            colors: [
                                color.opacity(isActive ? intensity * 0.3 : 0),
                                color.opacity(isActive ? intensity * 0.1 : 0)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .blur(radius: isActive ? 8 : 0)
                    .opacity(isActive ? (0.5 + 0.5 * sin(glowPhase)) : 0)
            )
            .onAppear {
                if isActive {
                    withAnimation(
                        Animation.easeInOut(duration: 2.0)
                            .repeatForever(autoreverses: true)
                    ) {
                        glowPhase = .pi * 2
                    }
                }
            }
    }
}

extension View {
    func notificationGlow(color: Color, intensity: Double = 0.6, isActive: Bool = true) -> some View {
        modifier(NotificationGlowModifier(color: color, intensity: intensity, isActive: isActive))
    }
}

// MARK: - Trust Glow Notification

struct TrustGlowNotification: View {
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            // Glow effect
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.green.opacity(0.4),
                            Color.green.opacity(0.1),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 10,
                        endRadius: 50
                    )
                )
                .frame(width: 100, height: 100)
                .scaleEffect(isAnimating ? 1.2 : 0.8)
                .opacity(isAnimating ? 0 : 0.6)

            // Inner pulse
            Circle()
                .fill(Color.green.opacity(0.3))
                .frame(width: 60, height: 60)
                .scaleEffect(isAnimating ? 1.0 : 0.6)
                .opacity(isAnimating ? 0.3 : 0.6)
        }
        .onAppear {
            withAnimation(
                Animation.easeOut(duration: 1.0)
                    .repeatForever(autoreverses: false)
            ) {
                isAnimating = true
            }
        }
    }
}

// MARK: - Chain Ripple Notification

struct ChainRippleNotification: View {
    @State private var ripplePhase: Double = 0.0

    var body: some View {
        ZStack {
            ForEach(0..<3) { index in
                Circle()
                    .stroke(
                        Color.blue.opacity(0.4 - Double(index) * 0.1),
                        lineWidth: 2
                    )
                    .frame(width: 40 + Double(index) * 30, height: 40 + Double(index) * 30)
                    .scaleEffect(1.0 + ripplePhase * 0.5)
                    .opacity(1.0 - ripplePhase)
            }
        }
        .onAppear {
            withAnimation(
                Animation.easeOut(duration: 1.5)
                    .repeatForever(autoreverses: false)
            ) {
                ripplePhase = 1.0
            }
        }
    }
}

// MARK: - Compliance Spark Notification

struct ComplianceSparkNotification: View {
    @State private var sparkles: [Sparkle] = []

    struct Sparkle: Identifiable {
        let id = UUID()
        var position: CGPoint
        var opacity: Double
        var scale: Double
    }

    var body: some View {
        ZStack {
            ForEach(sparkles) { sparkle in
                Image(systemName: "sparkle")
                    .foregroundColor(.amber)
                    .font(.system(size: 8))
                    .position(sparkle.position)
                    .opacity(sparkle.opacity)
                    .scaleEffect(sparkle.scale)
            }
        }
        .onAppear {
            generateSparkles()
            animateSparkles()
        }
    }

    private func generateSparkles() {
        sparkles = (0..<12).map { _ in
            Sparkle(
                position: CGPoint(
                    x: Double.random(in: 0...100),
                    y: Double.random(in: 0...100)
                ),
                opacity: 1.0,
                scale: 0.5
            )
        }
    }

    private func animateSparkles() {
        withAnimation(
            Animation.easeOut(duration: 0.8)
                .repeatForever(autoreverses: true)
        ) {
            for index in sparkles.indices {
                sparkles[index].opacity = Double.random(in: 0.3...1.0)
                sparkles[index].scale = Double.random(in: 0.5...1.5)
            }
        }
    }
}

// MARK: - Proof Bloom Burst

struct ProofBloomBurst: View {
    @State private var isExpanding = false

    var body: some View {
        ZStack {
            // Outer bloom
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.purple.opacity(0.5),
                            Color.purple.opacity(0.2),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 80
                    )
                )
                .frame(width: 160, height: 160)
                .scaleEffect(isExpanding ? 1.5 : 0.5)
                .opacity(isExpanding ? 0 : 0.8)

            // Inner burst
            Circle()
                .fill(Color.purple.opacity(0.6))
                .frame(width: 40, height: 40)
                .scaleEffect(isExpanding ? 2.0 : 1.0)
                .opacity(isExpanding ? 0.3 : 0.8)
        }
        .onAppear {
            withAnimation(
                Animation.spring(response: 0.6, dampingFraction: 0.6)
            ) {
                isExpanding = true
            }
        }
    }
}

// MARK: - Stale Anchor Haze

struct StaleAnchorHaze: View {
    @State private var hazePhase: Double = 0.0

    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(
                LinearGradient(
                    colors: [
                        Color.gray.opacity(0.1 + 0.05 * sin(hazePhase)),
                        Color.gray.opacity(0.05 + 0.02 * sin(hazePhase + .pi / 2))
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.gray.opacity(0.2), lineWidth: 1)
            )
            .onAppear {
                withAnimation(
                    Animation.easeInOut(duration: 3.0)
                        .repeatForever(autoreverses: true)
                ) {
                    hazePhase = .pi * 2
                }
            }
    }
}

// MARK: - Recruiter View Ping

struct RecruiterViewPing: View {
    @State private var pingRadius: CGFloat = 0
    @State private var pingOpacity: Double = 1.0

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    Color.blue.opacity(pingOpacity),
                    lineWidth: 2
                )
                .frame(width: 60 + pingRadius, height: 60 + pingRadius)
        }
        .onAppear {
            withAnimation(
                Animation.easeOut(duration: 1.0)
                    .repeatForever(autoreverses: false)
            ) {
                pingRadius = 40
                pingOpacity = 0
            }
        }
    }
}

// MARK: - Match Score Sparkle

struct MatchScoreSparkle: View {
    @State private var sparkleRotation: Double = 0
    @State private var sparkleScale: Double = 1.0

    var body: some View {
        ZStack {
            ForEach(0..<6) { index in
                Image(systemName: "star.fill")
                    .foregroundColor(.yellow)
                    .font(.system(size: 12))
                    .offset(
                        x: cos(Double(index) * .pi / 3) * 20,
                        y: sin(Double(index) * .pi / 3) * 20
                    )
                    .rotationEffect(.degrees(sparkleRotation))
                    .scaleEffect(sparkleScale)
                    .opacity(0.7)
            }
        }
        .onAppear {
            withAnimation(
                Animation.easeInOut(duration: 1.5)
                    .repeatForever(autoreverses: true)
            ) {
                sparkleRotation = 360
                sparkleScale = 1.3
            }
        }
    }
}

// MARK: - Trust Echo Animation

struct TrustEchoAnimation: View {
    @State private var echoWaves: [EchoWave] = []

    struct EchoWave: Identifiable {
        let id = UUID()
        var scale: Double
        var opacity: Double
    }

    var body: some View {
        ZStack {
            ForEach(echoWaves) { wave in
                Circle()
                    .stroke(
                        Color.green.opacity(wave.opacity),
                        lineWidth: 2
                    )
                    .frame(width: 50, height: 50)
                    .scaleEffect(wave.scale)
            }
        }
        .onAppear {
            startEcho()
        }
    }

    private func startEcho() {
        // Create multiple echo waves
        for i in 0..<3 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.2) {
                let wave = EchoWave(scale: 0.5, opacity: 0.8)
                echoWaves.append(wave)

                withAnimation(
                    Animation.easeOut(duration: 1.0)
                ) {
                    if let index = echoWaves.firstIndex(where: { $0.id == wave.id }) {
                        echoWaves[index].scale = 2.0
                        echoWaves[index].opacity = 0
                    }
                }

                // Remove after animation
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    echoWaves.removeAll { $0.id == wave.id }
                }
            }
        }
    }
}

// MARK: - Color Extensions

extension Color {
    static let amber = Color(red: 1.0, green: 0.75, blue: 0.0)
}








