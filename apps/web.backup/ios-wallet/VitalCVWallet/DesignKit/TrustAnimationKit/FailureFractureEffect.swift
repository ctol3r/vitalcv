//
//  FailureFractureEffect.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 14
//  Subtle red cracks for failure states
//

import SwiftUI

/// FailureFractureEffect - Red crack effect for failures
struct FailureFractureEffect: View {
    let intensity: Double
    @State private var cracks: [Crack] = []
    @State private var isVisible = false

    struct Crack: Identifiable {
        let id: UUID
        let path: Path
        var opacity: Double
        var strokeWidth: CGFloat
    }

    init(intensity: Double = 0.8) {
        self.intensity = intensity
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(cracks) { crack in
                    Path { path in
                        path = crack.path
                    }
                    .stroke(
                        Color.trustRose.opacity(crack.opacity),
                        style: StrokeStyle(
                            lineWidth: crack.strokeWidth,
                            lineCap: .round,
                            lineJoin: .round
                        )
                    )
                }
            }
            .onAppear {
                generateCracks(in: geometry.size)
                animateCracks()
            }
        }
    }

    private func generateCracks(in size: CGSize) {
        let crackCount = Int(intensity * 8)
        let center = CGPoint(x: size.width / 2, y: size.height / 2)

        for i in 0..<crackCount {
            let angle = Double(i) * (2 * .pi / Double(crackCount))
            let length = min(size.width, size.height) * 0.4

            // Create jagged crack path
            var path = Path()
            path.move(to: center)

            var currentPoint = center
            var currentAngle = angle
            let segments = 5

            for segment in 0..<segments {
                let segmentLength = length / CGFloat(segments)
                let angleVariation = Double.random(in: -0.3...0.3)
                currentAngle += angleVariation

                let nextPoint = CGPoint(
                    x: currentPoint.x + cos(currentAngle) * segmentLength,
                    y: currentPoint.y + sin(currentAngle) * segmentLength
                )

                path.addLine(to: nextPoint)
                currentPoint = nextPoint
            }

            let crack = Crack(
                id: UUID(),
                path: path,
                opacity: 0.0,
                strokeWidth: CGFloat.random(in: 1.5...3.0)
            )

            cracks.append(crack)
        }
    }

    private func animateCracks() {
        // Animate cracks appearing
        for (index, _) in cracks.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.1) {
                withAnimation(
                    Animation.easeOut(duration: 0.5)
                ) {
                    if index < cracks.count {
                        cracks[index].opacity = intensity * 0.6
                    }
                }
            }
        }

        // Subtle pulsing
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(
                Animation.easeInOut(duration: 2.0)
                    .repeatForever(autoreverses: true)
            ) {
                isVisible.toggle()
                for index in cracks.indices {
                    cracks[index].opacity = intensity * (isVisible ? 0.6 : 0.4)
                }
            }
        }
    }
}

/// FailureShakeView - Shake animation for failures
struct FailureShakeView: ViewModifier {
    @State private var shakeOffset: CGFloat = 0.0

    func body(content: Content) -> some View {
        content
            .offset(x: shakeOffset)
            .onAppear {
                shake()
            }
    }

    private func shake() {
        let shakeSequence: [CGFloat] = [-10, 10, -8, 8, -5, 5, -3, 3, 0]

        for (index, offset) in shakeSequence.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.05) {
                withAnimation(.linear(duration: 0.05)) {
                    shakeOffset = offset
                }
            }
        }
    }
}

extension View {
    /// Adds failure fracture effect (red cracks)
    func failureFracture(intensity: Double = 0.8) -> some View {
        overlay(
            FailureFractureEffect(intensity: intensity)
                .allowsHitTesting(false)
        )
    }

    /// Adds shake animation for failures
    func failureShake() -> some View {
        modifier(FailureShakeView())
    }
}

