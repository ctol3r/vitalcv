//
//  ChainDrift.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 20
//  Chain drift effect for unstable anchors
//

import SwiftUI

/// ChainDrift - Drift effect for unstable anchors
struct ChainDrift: ViewModifier {
    let instabilityLevel: Double // 0-1, higher = more unstable
    @State private var driftX: CGFloat = 0
    @State private var driftY: CGFloat = 0
    @State private var driftPhase: Double = 0.0

    init(instabilityLevel: Double) {
        self.instabilityLevel = max(0.0, min(1.0, instabilityLevel))
    }

    func body(content: Content) -> some View {
        content
            .offset(x: driftX, y: driftY)
            .onAppear {
                startDrift()
            }
            .onChange(of: instabilityLevel) { newLevel in
                updateDrift(for: newLevel)
            }
    }

    private func startDrift() {
        // Random drift pattern
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            withAnimation(.linear(duration: 0.1)) {
                let maxDrift = CGFloat(instabilityLevel * 10)
                driftX = CGFloat.random(in: -maxDrift...maxDrift)
                driftY = CGFloat.random(in: -maxDrift...maxDrift)
            }
        }

        // Continuous phase animation
        withAnimation(
            Animation.linear(duration: 2.0)
                .repeatForever(autoreverses: false)
        ) {
            driftPhase = 2 * .pi
        }
    }

    private func updateDrift(for level: Double) {
        // Adjust drift intensity based on instability
        // Higher instability = more drift
    }
}

/// UnstableAnchorIndicator - Visual indicator for unstable anchors
struct UnstableAnchorIndicator: View {
    let instabilityLevel: Double
    @State private var shakeOffset: CGFloat = 0
    @State private var glowIntensity: Double = 0.5

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.trustAmber)
                .offset(x: shakeOffset)

            Text("Unstable Anchor")
                .font(WalletTypography.caption)
                .foregroundColor(.trustAmber)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color.trustAmber.opacity(0.1))
                .overlay(
                    Capsule()
                        .stroke(
                            Color.trustAmber.opacity(glowIntensity),
                            lineWidth: 1
                        )
                )
        )
        .hazardGlow(intensity: instabilityLevel)
        .onAppear {
            startShake()
            startGlow()
        }
    }

    private func startShake() {
        let shakeSequence: [CGFloat] = [-2, 2, -1, 1, -2, 2, 0]

        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            for (index, offset) in shakeSequence.enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.05) {
                    withAnimation(.linear(duration: 0.05)) {
                        shakeOffset = offset
                    }
                }
            }
        }
    }

    private func startGlow() {
        withAnimation(
            Animation.easeInOut(duration: 1.5)
                .repeatForever(autoreverses: true)
        ) {
            glowIntensity = 0.8
        }
    }
}

extension View {
    /// Adds chain drift effect for unstable anchors
    func chainDrift(instabilityLevel: Double) -> some View {
        modifier(ChainDrift(instabilityLevel: instabilityLevel))
    }
}

