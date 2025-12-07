//
//  ProofPathline.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 33
//  Line draws as each step verifies
//

import SwiftUI

/// ProofPathline - Animated line that draws as steps verify
struct ProofPathline: View {
    let steps: [ProofStep]
    @State private var pathProgress: [Double] = []

    struct ProofStep: Identifiable {
        let id: UUID
        let title: String
        var isVerified: Bool
        let position: CGPoint
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Path line
                Path { path in
                    guard !steps.isEmpty else { return }

                    path.move(to: steps[0].position)

                    for i in 1..<steps.count {
                        let currentStep = steps[i]
                        let previousStep = steps[i - 1]

                        // Draw line to this step
                        path.addLine(to: currentStep.position)
                    }
                }
                .stroke(
                    Color.trustEmerald,
                    style: StrokeStyle(
                        lineWidth: 3,
                        lineCap: .round,
                        lineJoin: .round
                    )
                )
                .trim(from: 0, to: totalProgress)

                // Step nodes
                ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                    ProofStepNode(step: step, index: index, pathProgress: pathProgress)
                        .position(step.position)
                }
            }
        }
        .onAppear {
            initializeProgress()
        }
        .onChange(of: steps) { _ in
            updatePathProgress()
        }
    }

    private var totalProgress: Double {
        let verifiedCount = steps.filter { $0.isVerified }.count
        guard !steps.isEmpty else { return 0 }

        return Double(verifiedCount) / Double(steps.count - 1)
    }

    private func initializeProgress() {
        pathProgress = Array(repeating: 0.0, count: steps.count)
        updatePathProgress()
    }

    private func updatePathProgress() {
        for (index, step) in steps.enumerated() {
            if step.isVerified && pathProgress[index] < 1.0 {
                animateStepVerification(at: index)
            }
        }
    }

    private func animateStepVerification(at index: Int) {
        withAnimation(
            Animation.easeOut(duration: 0.6)
        ) {
            pathProgress[index] = 1.0
        }

        TrustHapticEngine.shared.stepCompleted()
    }
}

struct ProofStepNode: View {
    let step: ProofPathline.ProofStep
    let index: Int
    let pathProgress: [Double]

    @State private var nodeScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            Circle()
                .fill(nodeColor)
                .frame(width: 40, height: 40)
                .scaleEffect(nodeScale)
                .shadow(
                    color: nodeColor.opacity(0.5),
                    radius: step.isVerified ? 8 : 0,
                    x: 0,
                    y: 0
                )

            if step.isVerified {
                Image(systemName: "checkmark")
                    .foregroundColor(.white)
                    .font(.system(size: 18, weight: .bold))
            } else {
                Text("\(index + 1)")
                    .foregroundColor(.white)
                    .font(WalletTypography.headline)
            }
        }
        .onChange(of: step.isVerified) { verified in
            if verified {
                triggerNodeAnimation()
            }
        }
    }

    private var nodeColor: Color {
        step.isVerified ? .trustEmerald : .walletTextSecondary.opacity(0.3)
    }

    private func triggerNodeAnimation() {
        // Pop animation
        withAnimation(.easeOut(duration: 0.2)) {
            nodeScale = 1.3
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(TrustMotionConfig.bouncySpring) {
                nodeScale = 1.0
            }
        }
    }
}

extension View {
    /// Adds proof pathline (line draws as steps verify)
    func proofPathline(steps: [ProofPathline.ProofStep]) -> some View {
        overlay(
            ProofPathline(steps: steps)
                .allowsHitTesting(false)
        )
    }
}

