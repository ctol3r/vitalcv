//
//  ChainWalletIntegration.swift
//  VitalCVWallet
//
//  Created: Phase 4 - Tasks 25-32
//  Chain awareness integration in Wallet & Verification
//

import SwiftUI

// MARK: - Task 25: Chain Badge for Wallet Cards

/// ChainBadge - Badge showing chain status on wallet cards (soft glow = anchored)
struct ChainBadge: View {
    let status: ChainStatus
    let confirmations: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: ChainUXEngine.shared.icon(for: status))
                .font(.system(size: 10))
                .foregroundColor(badgeColor)

            if status == .anchored {
                Text("\(confirmations)")
                    .font(WalletTypography.caption2)
                    .foregroundColor(badgeColor)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(
            Capsule()
                .fill(badgeColor.opacity(0.15))
        )
        .chainGlow(
            color: badgeColor,
            intensity: status == .anchored ? 0.4 : 0.0,
            radius: 8
        )
    }

    private var badgeColor: Color {
        ChainColorPalette.color(for: status)
    }
}

// MARK: - Task 26: Chain Drift Animation

/// ChainDriftAnimation - Subtle drift animation for stale anchors
struct ChainDriftAnimation: ViewModifier {
    @State private var driftOffset: CGFloat = 0
    let isStale: Bool

    func body(content: Content) -> some View {
        content
            .offset(x: driftOffset)
            .onAppear {
                if isStale {
                    withAnimation(
                        Animation.easeInOut(duration: 3.0)
                            .repeatForever(autoreverses: true)
                    ) {
                        driftOffset = 2
                    }
                }
            }
    }
}

extension View {
    func chainDrift(isStale: Bool) -> some View {
        modifier(ChainDriftAnimation(isStale: isStale))
    }
}

// MARK: - Task 27: Tap to Verify Anchor Gesture

/// ChainAnchorVerificationGesture - Tap gesture to verify anchor
struct ChainAnchorVerificationGesture: ViewModifier {
    let anchor: ChainAnchor?
    let onVerify: () -> Void

    func body(content: Content) -> some View {
        content
            .onTapGesture {
                if anchor != nil {
                    onVerify()
                }
            }
            .overlay(
                Group {
                    if anchor != nil {
                        VStack {
                            Spacer()
                            HStack {
                                Spacer()
                                Text("Tap to verify anchor")
                                    .font(WalletTypography.caption2)
                                    .foregroundColor(.walletTextSecondary)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(
                                        Capsule()
                                            .fill(Color.walletCard.opacity(0.9))
                                    )
                                    .padding(.trailing, 8)
                                    .padding(.bottom, 8)
                            }
                        }
                    }
                }
            )
    }
}

extension View {
    func chainAnchorVerification(
        anchor: ChainAnchor?,
        onVerify: @escaping () -> Void
    ) -> some View {
        modifier(ChainAnchorVerificationGesture(anchor: anchor, onVerify: onVerify))
    }
}

// MARK: - Task 28: Progressive Chain Confidence Bar

/// ChainConfidenceBar - Progressive confidence bar for verification results
struct ChainConfidenceBar: View {
    let confirmations: Int
    let maxConfirmations: Int
    @State private var animatedProgress: Double = 0

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            HStack {
                Text("Chain Confidence")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)

                Spacer()

                Text("\(confirmations)/\(maxConfirmations)")
                    .font(WalletTypography.caption)
                    .foregroundColor(confidenceColor)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)

                    // Progress
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [confidenceColor, confidenceColor.opacity(0.7)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geometry.size.width * animatedProgress, height: 8)
                        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: animatedProgress)
                }
            }
            .frame(height: 8)
        }
        .onAppear {
            animatedProgress = Double(confirmations) / Double(maxConfirmations)
        }
        .onChange(of: confirmations) { newValue in
            withAnimation {
                animatedProgress = Double(newValue) / Double(maxConfirmations)
            }
        }
    }

    private var confidenceColor: Color {
        if confirmations >= 12 {
            return ChainColorPalette.emerald
        } else if confirmations >= 6 {
            return ChainColorPalette.emerald.opacity(0.8)
        } else if confirmations >= 3 {
            return ChainColorPalette.amber
        } else {
            return ChainColorPalette.glacialBlue
        }
    }
}

// MARK: - Task 29: Chain Watermark Animation

/// ChainWatermarkAnimation - Watermark animation behind high-trust credentials
struct ChainWatermarkAnimation: View {
    @State private var rotation: Double = 0
    @State private var scale: CGFloat = 1.0

    let trustScore: Double
    let isHighTrust: Bool

    var body: some View {
        if isHighTrust {
            ZStack {
                ForEach(0..<3) { index in
                    Image(systemName: "link.circle.fill")
                        .font(.system(size: 100))
                        .foregroundColor(ChainColorPalette.emerald.opacity(0.1))
                        .rotationEffect(.degrees(rotation + Double(index) * 120))
                        .scaleEffect(scale)
                        .offset(
                            x: cos((rotation + Double(index) * 120) * .pi / 180) * 50,
                            y: sin((rotation + Double(index) * 120) * .pi / 180) * 50
                        )
                }
            }
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 20.0)
                        .repeatForever(autoreverses: false)
                ) {
                    rotation = 360
                }

                withAnimation(
                    Animation.easeInOut(duration: 3.0)
                        .repeatForever(autoreverses: true)
                ) {
                    scale = 1.1
                }
            }
        }
    }
}

// MARK: - Task 30: Last Anchored Text Block

/// LastAnchoredTextBlock - Shows "Last anchored X days ago"
struct LastAnchoredTextBlock: View {
    let anchorDate: Date

    var body: some View {
        HStack(spacing: WalletSpacing.xs) {
            Image(systemName: "clock.fill")
                .font(.system(size: 12))
                .foregroundColor(.walletTextSecondary)

            Text("Last anchored \(daysAgo) ago")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color.walletCard)
        )
    }

    private var daysAgo: String {
        let days = Calendar.current.dateComponents([.day], from: anchorDate, to: Date()).day ?? 0
        if days == 0 {
            return "today"
        } else if days == 1 {
            return "1 day"
        } else {
            return "\(days) days"
        }
    }
}

// MARK: - Task 31: Failure Mode Visuals

/// FailureFractureEffect - Red fracture effect for failures
struct FailureFractureEffect: ViewModifier {
    @State private var fractureLines: [FractureLine] = []
    let isActive: Bool

    struct FractureLine {
        let start: CGPoint
        let end: CGPoint
        let opacity: Double
    }

    func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if isActive {
                        ZStack {
                            ForEach(fractureLines.indices, id: \.self) { index in
                                Path { path in
                                    let line = fractureLines[index]
                                    path.move(to: line.start)
                                    path.addLine(to: line.end)
                                }
                                .stroke(
                                    ChainColorPalette.red,
                                    style: StrokeStyle(lineWidth: 2, lineCap: .round)
                                )
                                .opacity(line.opacity)
                            }
                        }
                        .onAppear {
                            generateFractureLines()
                        }
                    }
                }
            )
    }

    private func generateFractureLines() {
        fractureLines = (0..<5).map { _ in
            FractureLine(
                start: CGPoint(
                    x: Double.random(in: 0...300),
                    y: Double.random(in: 0...300)
                ),
                end: CGPoint(
                    x: Double.random(in: 0...300),
                    y: Double.random(in: 0...300)
                ),
                opacity: Double.random(in: 0.5...1.0)
            )
        }
    }
}

extension View {
    func failureFracture(isActive: Bool) -> some View {
        modifier(FailureFractureEffect(isActive: isActive))
    }
}

// MARK: - Task 32: Chain Caching Indicator

/// ChainCachingIndicator - Shows when offline snapshot is used
struct ChainCachingIndicator: View {
    let isCached: Bool
    let cacheAge: TimeInterval?

    var body: some View {
        if isCached {
            HStack(spacing: WalletSpacing.xs) {
                Image(systemName: "tray.fill")
                    .font(.system(size: 10))
                    .foregroundColor(ChainColorPalette.amber)

                Text(cacheText)
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(ChainColorPalette.amber.opacity(0.15))
            )
        }
    }

    private var cacheText: String {
        if let age = cacheAge {
            let hours = Int(age / 3600)
            if hours < 1 {
                return "Cached (offline)"
            } else {
                return "Cached \(hours)h ago"
            }
        }
        return "Cached (offline)"
    }
}








