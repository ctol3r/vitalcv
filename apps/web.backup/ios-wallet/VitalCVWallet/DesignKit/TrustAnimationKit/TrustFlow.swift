//
//  TrustFlow.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 24
//  Combined evidence + chain animations for "trustFlow"
//

import SwiftUI

/// TrustFlow - Combined evidence and chain animations
struct TrustFlow: View {
    let evidence: [EvidenceItem]
    let chainState: ChainState
    @State private var flowPhase: Double = 0.0
    @State private var activePath: Int = 0

    struct EvidenceItem: Identifiable {
        let id: UUID
        let title: String
        let trustScore: Double
        let isVerified: Bool
    }

    struct ChainState {
        let confirmationCount: Int
        let isAnchored: Bool
        let anchorHash: String?
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                TrustAnimatedBackground(state: overallState, trustScore: overallTrustScore)

                // Flow paths
                ForEach(0..<evidence.count, id: \.self) { index in
                    if index <= activePath {
                        flowPath(from: evidence[index], to: chainState, in: geometry.size, index: index)
                    }
                }

                // Evidence items
                ForEach(Array(evidence.enumerated()), id: \.element.id) { index, item in
                    EvidenceNodeView(item: item, index: index, geometry: geometry.size)
                        .modifier(EvidenceNodeModifier(isActive: index <= activePath))
                }

                // Chain node
                ChainNodeView(state: chainState, position: CGPoint(x: geometry.size.width * 0.8, y: geometry.size.height * 0.5))
            }
            .onAppear {
                startFlow()
            }
        }
    }

    private var overallState: TrustState {
        if chainState.isAnchored && overallTrustScore >= 80 {
            return .passed
        } else if chainState.confirmationCount > 0 {
            return .verifying
        } else {
            return .idle
        }
    }

    private var overallTrustScore: Double {
        let scores = evidence.map { $0.trustScore }
        return scores.reduce(0, +) / Double(scores.count)
    }

    private func flowPath(from evidence: EvidenceItem, to chain: ChainState, in size: CGSize, index: Int) -> some View {
        let startPoint = CGPoint(x: size.width * 0.2, y: size.height * (0.3 + Double(index) * 0.2))
        let endPoint = CGPoint(x: size.width * 0.8, y: size.height * 0.5)

        return Path { path in
            path.move(to: startPoint)
            path.addCurve(
                to: endPoint,
                control1: CGPoint(x: size.width * 0.4, y: startPoint.y),
                control2: CGPoint(x: size.width * 0.6, y: endPoint.y)
            )
        }
        .stroke(
            flowColor,
            style: StrokeStyle(
                lineWidth: 3,
                lineCap: .round,
                dash: [5, 5]
            )
        )
        .opacity(flowOpacity)
        .animation(
            Animation.linear(duration: 1.5)
                .repeatForever(autoreverses: false)
                .delay(Double(index) * 0.2),
            value: flowPhase
        )
    }

    private var flowColor: Color {
        if chainState.isAnchored {
            return .trustEmerald
        } else {
            return .trustIndigo
        }
    }

    private var flowOpacity: Double {
        sin(flowPhase * .pi * 2) * 0.3 + 0.7
    }

    private func startFlow() {
        // Animate path activation
        for i in 0..<evidence.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.5) {
                withAnimation(TrustMotionConfig.smoothSpring) {
                    activePath = i
                }
                TrustHapticEngine.shared.stepCompleted()
            }
        }

        // Continuous flow animation
        withAnimation(
            Animation.linear(duration: 2.0)
                .repeatForever(autoreverses: false)
        ) {
            flowPhase = 1.0
        }
    }
}

struct EvidenceNodeView: View {
    let item: TrustFlow.EvidenceItem
    let index: Int
    let geometry: CGSize

    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(item.isVerified ? .trustEmerald : .walletTextSecondary.opacity(0.3))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: item.isVerified ? "checkmark" : "circle")
                        .foregroundColor(.white)
                )
                .modifier(TrustGlowIntensity(trustScore: item.trustScore, radius: 15))

            Text(item.title)
                .font(WalletTypography.caption2)
                .foregroundColor(.walletText)
                .lineLimit(1)
        }
        .position(
            x: geometry.width * 0.2,
            y: geometry.height * (0.3 + Double(index) * 0.2)
        )
    }
}

struct ChainNodeView: View {
    let state: TrustFlow.ChainState
    let position: CGPoint

    var body: some View {
        VStack(spacing: 8) {
            AnchorPulse(confirmationCount: state.confirmationCount)

            if state.isAnchored {
                Text("Anchored")
                    .font(WalletTypography.caption)
                    .foregroundColor(.trustEmerald)
            } else {
                Text("Pending")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .position(position)
    }
}

struct EvidenceNodeModifier: ViewModifier {
    let isActive: Bool

    func body(content: Content) -> some View {
        content
            .scaleEffect(isActive ? 1.0 : 0.8)
            .opacity(isActive ? 1.0 : 0.5)
    }
}

extension View {
    /// Combines evidence + chain animations for trustFlow
    func trustFlow(evidence: [TrustFlow.EvidenceItem], chainState: TrustFlow.ChainState) -> some View {
        overlay(
            TrustFlow(evidence: evidence, chainState: chainState)
                .allowsHitTesting(false)
        )
    }
}

