//
//  ZKTrustEffects.swift
//  VitalCVWallet
//
//  Created: Advanced Chain Anchoring & ZK-Proof Identity ARC - Phase 5
//  ZK Trust UX effects and cryptographic animations
//

import SwiftUI

// MARK: - Task 33: ZK Shimmer Effect

/// ZKShimmerEffect - Shimmer effect when proofs succeed
public struct ZKShimmerEffect: ViewModifier {
    @State private var phase: CGFloat = 0
    let isActive: Bool

    public func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if isActive {
                        LinearGradient(
                            colors: [
                                Color.clear,
                                Color.white.opacity(0.3),
                                Color.clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .offset(x: phase * 200 - 100)
                        .blur(radius: 10)
                    }
                }
            )
            .onAppear {
                if isActive {
                    withAnimation(
                        Animation.linear(duration: 1.5)
                            .repeatForever(autoreverses: false)
                    ) {
                        phase = 1.0
                    }
                }
            }
    }
}

extension View {
    public func zkShimmer(isActive: Bool) -> some View {
        modifier(ZKShimmerEffect(isActive: isActive))
    }
}

// MARK: - Task 34: Anchor Glow 2.0

/// AnchorGlow2 - Glow synced to block confirmations
public struct AnchorGlow2: ViewModifier {
    let confirmations: Int
    let maxConfirmations: Int
    @State private var pulsePhase: Double = 0

    public func body(content: Content) -> some View {
        content
            .overlay(
                Circle()
                    .stroke(
                        ChainColorPalette.emerald,
                        lineWidth: 2
                    )
                    .scaleEffect(1.0 + CGFloat(pulsePhase) * 0.2)
                    .opacity(1.0 - Double(pulsePhase))
            )
            .shadow(
                color: ChainColorPalette.emerald.opacity(confirmationOpacity),
                radius: confirmationRadius,
                x: 0,
                y: 0
            )
            .onAppear {
                withAnimation(
                    Animation.easeInOut(duration: 2.0)
                        .repeatForever(autoreverses: true)
                ) {
                    pulsePhase = 1.0
                }
            }
    }

    private var confirmationOpacity: Double {
        let ratio = Double(confirmations) / Double(max(maxConfirmations, 1))
        return min(ratio * 0.8, 0.8)
    }

    private var confirmationRadius: CGFloat {
        let ratio = Double(confirmations) / Double(max(maxConfirmations, 1))
        return CGFloat(ratio * 20)
    }
}

extension View {
    public func anchorGlow2(confirmations: Int, maxConfirmations: Int = 12) -> some View {
        modifier(AnchorGlow2(confirmations: confirmations, maxConfirmations: maxConfirmations))
    }
}

// MARK: - Task 35: Identity Pulse

/// IdentityPulse - Pulse tied to ZK commitment integrity
public struct IdentityPulse: View {
    let integrity: Double // 0.0 to 1.0
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 0.5

    public var body: some View {
        Circle()
            .fill(integrityColor.opacity(pulseOpacity))
            .frame(width: 20, height: 20)
            .scaleEffect(pulseScale)
            .onAppear {
                withAnimation(
                    Animation.easeInOut(duration: 1.0)
                        .repeatForever(autoreverses: true)
                ) {
                    pulseScale = 1.0 + CGFloat(integrity) * 0.3
                    pulseOpacity = 0.3 + Double(integrity) * 0.4
                }
            }
    }

    private var integrityColor: Color {
        if integrity >= 0.8 {
            return .walletSuccess
        } else if integrity >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }
}

// MARK: - Task 36: Cryptographic Breath Animation

/// CryptographicBreath - Blinds opening to reveal animation
public struct CryptographicBreath: View {
    let isRevealing: Bool
    @State private var blindOffset: CGFloat = 0
    @State private var contentOpacity: Double = 0

    public var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Content
                Rectangle()
                    .fill(Color.walletCard)
                    .opacity(contentOpacity)

                // Blinds
                HStack(spacing: 0) {
                    ForEach(0..<10, id: \.self) { index in
                        Rectangle()
                            .fill(Color.walletBackground)
                            .frame(width: geometry.size.width / 10)
                            .offset(x: blindOffset)
                    }
                }
            }
            .onChange(of: isRevealing) { revealing in
                if revealing {
                    withAnimation(.easeInOut(duration: 1.0)) {
                        blindOffset = geometry.size.width
                        contentOpacity = 1.0
                    }
                } else {
                    withAnimation(.easeInOut(duration: 1.0)) {
                        blindOffset = 0
                        contentOpacity = 0
                    }
                }
            }
        }
    }
}

// MARK: - Task 37: Hidden Field Aura

/// HiddenFieldAura - Aura for zero-disclosure mode
public struct HiddenFieldAura: ViewModifier {
    let isHidden: Bool
    @State private var auraPhase: Double = 0

    public func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if isHidden {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(
                                Color.walletPrimary.opacity(auraOpacity),
                                lineWidth: 2
                            )
                            .blur(radius: auraBlur)
                    }
                }
            )
            .onAppear {
                if isHidden {
                    withAnimation(
                        Animation.easeInOut(duration: 2.0)
                            .repeatForever(autoreverses: true)
                    ) {
                        auraPhase = 1.0
                    }
                }
            }
    }

    private var auraOpacity: Double {
        0.3 + Double(auraPhase) * 0.3
    }

    private var auraBlur: CGFloat {
        CGFloat(2 + auraPhase * 4)
    }
}

extension View {
    public func hiddenFieldAura(isHidden: Bool) -> some View {
        modifier(HiddenFieldAura(isHidden: isHidden))
    }
}

// MARK: - Task 38: Chain Ripple++

/// ChainRipplePlusPlus - Multi-ledger anchor matches ripple
public struct ChainRipplePlusPlus: View {
    let anchorCount: Int
    @State private var ripplePhase: Double = 0

    public var body: some View {
        ZStack {
            ForEach(0..<anchorCount, id: \.self) { index in
                Circle()
                    .stroke(
                        ChainColorPalette.emerald.opacity(rippleOpacity(for: index)),
                        lineWidth: 2
                    )
                    .frame(width: rippleSize(for: index), height: rippleSize(for: index))
            }
        }
        .onAppear {
            withAnimation(
                Animation.easeOut(duration: 2.0)
                    .repeatForever(autoreverses: false)
            ) {
                ripplePhase = 1.0
            }
        }
    }

    private func rippleSize(for index: Int) -> CGFloat {
        let baseSize: CGFloat = 40
        let delay = Double(index) * 0.3
        let phase = max(0, ripplePhase - delay)
        return baseSize + CGFloat(phase) * 60
    }

    private func rippleOpacity(for index: Int) -> Double {
        let delay = Double(index) * 0.3
        let phase = max(0, ripplePhase - delay)
        return max(0, 1.0 - phase)
    }
}

// MARK: - Task 39: Compliance + ZK Synergy Glow

/// ComplianceZKSynergyGlow - Fully compliant + full ZK = radiant
public struct ComplianceZKSynergyGlow: ViewModifier {
    let complianceScore: Double
    let zkScore: Double
    @State private var glowPhase: Double = 0

    public func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        RadialGradient(
                            colors: synergyColors,
                            center: .center,
                            startRadius: 0,
                            endRadius: 100
                        )
                    )
                    .opacity(synergyOpacity)
                    .blur(radius: synergyBlur)
            )
            .onAppear {
                withAnimation(
                    Animation.easeInOut(duration: 2.0)
                        .repeatForever(autoreverses: true)
                ) {
                    glowPhase = 1.0
                }
            }
    }

    private var synergyScore: Double {
        (complianceScore + zkScore) / 2.0
    }

    private var synergyColors: [Color] {
        if synergyScore >= 0.9 {
            return [
                Color.walletSuccess.opacity(0.6),
                Color.walletPrimary.opacity(0.3),
                Color.clear
            ]
        } else if synergyScore >= 0.7 {
            return [
                Color.walletWarning.opacity(0.4),
                Color.walletPrimary.opacity(0.2),
                Color.clear
            ]
        } else {
            return [
                Color.walletTextSecondary.opacity(0.2),
                Color.clear
            ]
        }
    }

    private var synergyOpacity: Double {
        let base = synergyScore * 0.8
        return base + Double(glowPhase) * 0.2
    }

    private var synergyBlur: CGFloat {
        CGFloat(10 + synergyScore * 20)
    }
}

extension View {
    public func complianceZKSynergyGlow(complianceScore: Double, zkScore: Double) -> some View {
        modifier(ComplianceZKSynergyGlow(complianceScore: complianceScore, zkScore: zkScore))
    }
}

// MARK: - Combined Trust Effect View

/// TrustEffectContainer - Container for all trust effects
public struct TrustEffectContainer<Content: View>: View {
    let content: Content
    let zkProofActive: Bool
    let confirmations: Int
    let integrity: Double
    let complianceScore: Double
    let zkScore: Double

    public init(
        zkProofActive: Bool = false,
        confirmations: Int = 0,
        integrity: Double = 1.0,
        complianceScore: Double = 1.0,
        zkScore: Double = 1.0,
        @ViewBuilder content: () -> Content
    ) {
        self.zkProofActive = zkProofActive
        self.confirmations = confirmations
        self.integrity = integrity
        self.complianceScore = complianceScore
        self.zkScore = zkScore
        self.content = content()
    }

    public var body: some View {
        content
            .zkShimmer(isActive: zkProofActive)
            .anchorGlow2(confirmations: confirmations)
            .complianceZKSynergyGlow(complianceScore: complianceScore, zkScore: zkScore)
    }
}








