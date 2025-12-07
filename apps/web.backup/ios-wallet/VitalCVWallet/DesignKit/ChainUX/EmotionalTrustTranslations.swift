//
//  EmotionalTrustTranslations.swift
//  VitalCVWallet
//
//  Created: Phase 5 - Tasks 33-40
//  Turning cryptographic truth into emotional intuition
//

import SwiftUI

// MARK: - Task 33: Chained Certainty Gradient

/// ChainedCertaintyGradient - Visual metaphor for proof solidity
struct ChainedCertaintyGradient: View {
    let trustScore: Double
    let confirmations: Int

    var body: some View {
        ZStack {
            // Base gradient
            LinearGradient(
                colors: gradientColors,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Chain link pattern overlay
            ChainLinkPattern(intensity: trustScore)
                .opacity(0.3)
        }
    }

    private var gradientColors: [Color] {
        let baseColors: [Color]

        if trustScore >= 0.8 {
            baseColors = [
                ChainColorPalette.emerald600,
                ChainColorPalette.emerald400,
                ChainColorPalette.emerald500
            ]
        } else if trustScore >= 0.5 {
            baseColors = [
                ChainColorPalette.amber600,
                ChainColorPalette.amber400,
                ChainColorPalette.amber500
            ]
        } else {
            baseColors = [
                ChainColorPalette.glacialBlue600,
                ChainColorPalette.glacialBlue400,
                ChainColorPalette.glacialBlue500
            ]
        }

        return baseColors
    }
}

/// ChainLinkPattern - Chain link pattern overlay
struct ChainLinkPattern: View {
    let intensity: Double

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                let linkSize: CGFloat = 20
                let rows = Int(geometry.size.height / linkSize)
                let cols = Int(geometry.size.width / linkSize)

                for row in 0..<rows {
                    for col in 0..<cols {
                        let x = CGFloat(col) * linkSize
                        let y = CGFloat(row) * linkSize

                        // Draw chain link
                        path.addEllipse(in: CGRect(
                            x: x,
                            y: y,
                            width: linkSize * 0.8,
                            height: linkSize * 0.8
                        ))
                    }
                }
            }
            .stroke(ChainColorPalette.emerald, lineWidth: 1)
            .opacity(intensity)
        }
    }
}

// MARK: - Task 34: Anchor Success Bloom

/// AnchorSuccessBloom - Green petal expansion animation
struct AnchorSuccessBloom: View {
    @State private var bloomScale: CGFloat = 0.0
    @State private var petalRotation: Double = 0

    let petalCount: Int

    init(petalCount: Int = 8) {
        self.petalCount = petalCount
    }

    var body: some View {
        ZStack {
            ForEach(0..<petalCount, id: \.self) { index in
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: [
                                ChainColorPalette.emerald400,
                                ChainColorPalette.emerald600
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 20, height: 60)
                    .offset(y: -30)
                    .rotationEffect(.degrees(Double(index) * 360.0 / Double(petalCount)) + petalRotation)
                    .scaleEffect(bloomScale)
                    .opacity(bloomScale > 0.5 ? 1.0 : bloomScale * 2)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.6)) {
                bloomScale = 1.0
            }

            withAnimation(
                Animation.linear(duration: 2.0)
                    .repeatForever(autoreverses: false)
            ) {
                petalRotation = 360
            }
        }
    }
}

// MARK: - Task 35: Anchor Drift Haze

/// AnchorDriftHaze - Soft blur rise for stale anchors
struct AnchorDriftHaze: View {
    @State private var hazeOffset: CGFloat = 0
    @State private var hazeOpacity: Double = 0

    let isStale: Bool

    var body: some View {
        if isStale {
            ZStack {
                // Haze layers
                ForEach(0..<3) { index in
                    RoundedRectangle(cornerRadius: 20)
                        .fill(
                            LinearGradient(
                                colors: [
                                    ChainColorPalette.amber.opacity(0.3),
                                    ChainColorPalette.amber.opacity(0.1),
                                    Color.clear
                                ],
                                startPoint: .bottom,
                                endPoint: .top
                            )
                        )
                        .blur(radius: CGFloat(10 + index * 5))
                        .offset(y: hazeOffset - CGFloat(index * 20))
                        .opacity(hazeOpacity)
                }
            }
            .onAppear {
                withAnimation(
                    Animation.easeInOut(duration: 4.0)
                        .repeatForever(autoreverses: true)
                ) {
                    hazeOffset = 30
                    hazeOpacity = 0.6
                }
            }
        }
    }
}

// MARK: - Task 36: Trust Harmonics

/// TrustHarmonics - Subtle vibration patterns for each chain state
struct TrustHarmonics: ViewModifier {
    @State private var harmonicPhase: Double = 0
    let status: ChainStatus

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    Path { path in
                        let width = geometry.size.width
                        let height = geometry.size.height
                        let frequency = harmonicFrequency
                        let amplitude = 2.0

                        path.move(to: CGPoint(x: 0, y: height / 2))

                        for x in stride(from: 0, through: width, by: 1) {
                            let y = height / 2 + amplitude * sin((Double(x) / width * frequency * 2 * .pi) + harmonicPhase)
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                    .stroke(harmonicColor.opacity(0.2), lineWidth: 1)
                    .opacity(0.3)
                }
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: harmonicDuration)
                        .repeatForever(autoreverses: false)
                ) {
                    harmonicPhase = .pi * 2
                }
            }
    }

    private var harmonicFrequency: Double {
        switch status {
        case .anchored: return 3.0
        case .confirming: return 2.0
        case .stale: return 1.0
        case .unverified: return 0.5
        case .rejected: return 0.0
        }
    }

    private var harmonicColor: Color {
        ChainColorPalette.color(for: status)
    }

    private var harmonicDuration: Double {
        switch status {
        case .anchored: return 2.0
        case .confirming: return 1.5
        case .stale: return 3.0
        case .unverified: return 4.0
        case .rejected: return 0.0
        }
    }
}

extension View {
    func trustHarmonics(status: ChainStatus) -> some View {
        modifier(TrustHarmonics(status: status))
    }
}

// MARK: - Task 37: Chain Heartbeat Animation

/// ChainHeartbeatAnimation - Pulses faster with fresh anchors
struct ChainHeartbeatAnimation: View {
    @State private var heartbeatScale: CGFloat = 1.0
    @State private var heartbeatOpacity: Double = 1.0

    let anchorAge: TimeInterval
    let isAnchored: Bool

    private var heartbeatInterval: Double {
        // Faster heartbeat for fresh anchors
        if anchorAge < 86400 { // Less than 1 day
            return 0.8
        } else if anchorAge < 604800 { // Less than 1 week
            return 1.2
        } else {
            return 2.0
        }
    }

    var body: some View {
        if isAnchored {
            Circle()
                .fill(ChainColorPalette.emerald)
                .frame(width: 8, height: 8)
                .scaleEffect(heartbeatScale)
                .opacity(heartbeatOpacity)
                .onAppear {
                    withAnimation(
                        Animation.easeInOut(duration: heartbeatInterval)
                            .repeatForever(autoreverses: true)
                    ) {
                        heartbeatScale = 1.3
                        heartbeatOpacity = 0.7
                    }
                }
        }
    }
}

// MARK: - Task 38: Identity Alignment Bloom

/// IdentityAlignmentBloom - Bloom when chain + issuer match perfectly
struct IdentityAlignmentBloom: View {
    @State private var bloomIntensity: Double = 0
    @State private var rotation: Double = 0

    let isAligned: Bool

    var body: some View {
        if isAligned {
            ZStack {
                // Concentric circles
                ForEach(0..<3) { index in
                    Circle()
                        .stroke(
                            ChainColorPalette.emerald,
                            style: StrokeStyle(lineWidth: 2)
                        )
                        .frame(width: CGFloat(40 + index * 20), height: CGFloat(40 + index * 20))
                        .opacity(bloomIntensity * (1.0 - Double(index) * 0.3))
                        .scaleEffect(1.0 + bloomIntensity * 0.5)
                        .rotationEffect(.degrees(rotation))
                }
            }
            .onAppear {
                withAnimation(
                    Animation.easeOut(duration: 1.0)
                        .repeatForever(autoreverses: true)
                ) {
                    bloomIntensity = 1.0
                }

                withAnimation(
                    Animation.linear(duration: 3.0)
                        .repeatForever(autoreverses: false)
                ) {
                    rotation = 360
                }
            }
        }
    }
}

// MARK: - Task 39: Anchor Descent Animation

/// AnchorDescentAnimation - Block drops into place
struct AnchorDescentAnimation: View {
    @State private var dropOffset: CGFloat = -100
    @State private var dropRotation: Double = 0
    @State private var impactScale: CGFloat = 1.0

    let isAnchoring: Bool

    var body: some View {
        if isAnchoring {
            ZStack {
                // Block
                RoundedRectangle(cornerRadius: 8)
                    .fill(
                        LinearGradient(
                            colors: [
                                ChainColorPalette.emerald600,
                                ChainColorPalette.emerald400
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)
                    .overlay(
                        Image(systemName: "cube.fill")
                            .foregroundColor(.white)
                            .font(.system(size: 24))
                    )
                    .offset(y: dropOffset)
                    .rotationEffect(.degrees(dropRotation))
                    .scaleEffect(impactScale)

                // Impact ripple
                if dropOffset > -10 {
                    ForEach(0..<3) { index in
                        Circle()
                            .stroke(ChainColorPalette.emerald, lineWidth: 2)
                            .frame(width: 60 + CGFloat(index * 20), height: 60 + CGFloat(index * 20))
                            .opacity(1.0 - Double(index) * 0.3)
                            .scaleEffect(impactScale)
                    }
                }
            }
            .onAppear {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.6)) {
                    dropOffset = 0
                    dropRotation = 360
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                        impactScale = 1.2
                    }

                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        withAnimation {
                            impactScale = 1.0
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Task 40: High-Trust Resonance Pulse

/// HighTrustResonancePulse - Signature SparkJoy effect when fully verified
struct HighTrustResonancePulse: View {
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 1.0
    @State private var sparkleRotation: Double = 0

    let trustScore: Double
    let isFullyVerified: Bool

    var body: some View {
        if isFullyVerified && trustScore >= 0.9 {
            ZStack {
                // Main pulse
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                ChainColorPalette.emerald.opacity(0.6),
                                ChainColorPalette.emerald.opacity(0.0)
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 100
                        )
                    )
                    .frame(width: 200, height: 200)
                    .scaleEffect(pulseScale)
                    .opacity(pulseOpacity)

                // Sparkles
                ForEach(0..<8) { index in
                    Image(systemName: "sparkle")
                        .foregroundColor(ChainColorPalette.emerald)
                        .font(.system(size: 16))
                        .offset(
                            x: cos(Double(index) * .pi / 4) * 60,
                            y: sin(Double(index) * .pi / 4) * 60
                        )
                        .rotationEffect(.degrees(sparkleRotation))
                        .opacity(pulseOpacity)
                }
            }
            .onAppear {
                // Pulse animation
                withAnimation(
                    Animation.easeInOut(duration: 2.0)
                        .repeatForever(autoreverses: true)
                ) {
                    pulseScale = 1.5
                    pulseOpacity = 0.3
                }

                // Sparkle rotation
                withAnimation(
                    Animation.linear(duration: 3.0)
                        .repeatForever(autoreverses: false)
                ) {
                    sparkleRotation = 360
                }
            }
        }
    }
}








