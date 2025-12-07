//
//  ComplianceSparkles.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 35
//  Sparkles activate when all compliance checks pass
//

import SwiftUI

/// ComplianceSparkles - Sparkle animation when compliance checks pass
struct ComplianceSparkles: View {
    let isComplete: Bool
    let sparkleCount: Int

    @State private var sparkles: [Sparkle] = []

    struct Sparkle: Identifiable {
        let id: UUID
        var position: CGPoint
        var scale: CGFloat
        var opacity: Double
        var rotation: Double
    }

    init(isComplete: Bool, sparkleCount: Int = 20) {
        self.isComplete = isComplete
        self.sparkleCount = sparkleCount
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(sparkles) { sparkle in
                    SparkleShape()
                        .fill(Color.trustEmerald.opacity(sparkle.opacity))
                        .frame(width: 12, height: 12)
                        .scaleEffect(sparkle.scale)
                        .rotationEffect(.degrees(sparkle.rotation))
                        .position(sparkle.position)
                }
            }
            .onChange(of: isComplete) { complete in
                if complete {
                    generateSparkles(in: geometry.size)
                }
            }
        }
    }

    private func generateSparkles(in size: CGSize) {
        sparkles.removeAll()

        for i in 0..<sparkleCount {
            let sparkle = Sparkle(
                id: UUID(),
                position: CGPoint(
                    x: CGFloat.random(in: 0...size.width),
                    y: CGFloat.random(in: 0...size.height)
                ),
                scale: 0.0,
                opacity: 1.0,
                rotation: Double.random(in: 0...360)
            )

            sparkles.append(sparkle)

            // Animate sparkle
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.05) {
                animateSparkle(id: sparkle.id)
            }
        }

        TrustHapticEngine.shared.compliancePassed()
        TrustTickSound.shared.playBloom()
    }

    private func animateSparkle(id: UUID) {
        guard let index = sparkles.firstIndex(where: { $0.id == id }) else { return }

        // Sparkle in
        withAnimation(.easeOut(duration: 0.3)) {
            sparkles[index].scale = 1.0
        }

        // Sparkle out
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(.easeIn(duration: 0.5)) {
                sparkles[index].scale = 0.0
                sparkles[index].opacity = 0.0
                sparkles[index].rotation += 180
            }
        }
    }
}

struct SparkleShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()

        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2

        // Star shape
        for i in 0..<8 {
            let angle = Double(i) * (.pi / 4)
            let pointRadius = i % 2 == 0 ? radius : radius * 0.5
            let x = center.x + cos(angle) * pointRadius
            let y = center.y + sin(angle) * pointRadius

            if i == 0 {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }

        path.closeSubpath()
        return path
    }
}

/// ComplianceChecklist - Checklist with sparkle completion
struct ComplianceChecklist: View {
    let checks: [ComplianceCheck]
    @State private var completedChecks: Set<UUID> = []

    struct ComplianceCheck: Identifiable {
        let id: UUID
        let title: String
        let isRequired: Bool
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(checks) { check in
                ComplianceCheckRow(
                    check: check,
                    isCompleted: completedChecks.contains(check.id)
                )
                .onTapGesture {
                    toggleCheck(check.id)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.walletCard)
                .overlay(
                    ComplianceSparkles(
                        isComplete: completedChecks.count == checks.count,
                        sparkleCount: 30
                    )
                    .allowsHitTesting(false)
                )
        )
    }

    private func toggleCheck(_ id: UUID) {
        if completedChecks.contains(id) {
            completedChecks.remove(id)
        } else {
            completedChecks.insert(id)
            TrustHapticEngine.shared.stepCompleted()
        }
    }
}

struct ComplianceCheckRow: View {
    let check: ComplianceChecklist.ComplianceCheck
    let isCompleted: Bool

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(isCompleted ? Color.trustEmerald : Color.walletTextSecondary.opacity(0.2))
                    .frame(width: 24, height: 24)

                if isCompleted {
                    Image(systemName: "checkmark")
                        .foregroundColor(.white)
                        .font(.system(size: 12, weight: .bold))
                }
            }

            Text(check.title)
                .font(WalletTypography.body)
                .foregroundColor(.walletText)

            Spacer()

            if check.isRequired {
                Text("Required")
                    .font(WalletTypography.caption)
                    .foregroundColor(.trustAmber)
            }
        }
        .padding(.vertical, 4)
    }
}

extension View {
    /// Adds compliance sparkles when all checks pass
    func complianceSparkles(isComplete: Bool, count: Int = 20) -> some View {
        overlay(
            ComplianceSparkles(isComplete: isComplete, sparkleCount: count)
                .allowsHitTesting(false)
        )
    }
}

