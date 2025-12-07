//
//  ComplianceBloom.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 15
//  Green ripple on good DEA/licensure compliance
//

import SwiftUI

/// ComplianceBloom - Green ripple animation for compliance success
struct ComplianceBloom: View {
    let complianceType: ComplianceType
    @State private var ripples: [ComplianceRipple] = []

    enum ComplianceType {
        case dea
        case licensure
        case board
        case credential

        var color: Color {
            return .trustEmerald
        }

        var icon: String {
            switch self {
            case .dea:
                return "staroflife.fill"
            case .licensure:
                return "checkmark.seal.fill"
            case .board:
                return "building.columns.fill"
            case .credential:
                return "doc.text.fill"
            }
        }
    }

    struct ComplianceRipple: Identifiable {
        let id: UUID
        var scale: CGFloat
        var opacity: Double
        var delay: Double
    }

    var body: some View {
        ZStack {
            // Central icon
            Image(systemName: complianceType.icon)
                .font(.system(size: 32, weight: .semibold))
                .foregroundColor(complianceType.color)
                .zIndex(10)

            // Ripples
            ForEach(ripples) { ripple in
                Circle()
                    .stroke(
                        complianceType.color.opacity(ripple.opacity),
                        style: StrokeStyle(
                            lineWidth: 3,
                            lineCap: .round
                        )
                    )
                    .frame(width: 80, height: 80)
                    .scaleEffect(ripple.scale)
            }
        }
        .onAppear {
            generateRipples()
        }
    }

    private func generateRipples() {
        let rippleCount = 4

        for i in 0..<rippleCount {
            let ripple = ComplianceRipple(
                id: UUID(),
                scale: 0.3,
                opacity: 0.8,
                delay: Double(i) * 0.3
            )

            ripples.append(ripple)

            // Animate ripple
            DispatchQueue.main.asyncAfter(deadline: .now() + ripple.delay) {
                animateRipple(id: ripple.id)
            }
        }

        // Restart after all ripples complete
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(rippleCount) * 0.3 + 1.5) {
            ripples.removeAll()
            generateRipples()
        }
    }

    private func animateRipple(id: UUID) {
        guard let index = ripples.firstIndex(where: { $0.id == id }) else { return }

        withAnimation(
            Animation.easeOut(duration: 1.2)
        ) {
            ripples[index].scale = 2.0
            ripples[index].opacity = 0.0
        }
    }
}

/// ComplianceCheckmark - Animated checkmark for compliance
struct ComplianceCheckmark: View {
    let complianceType: ComplianceBloom.ComplianceType
    @State private var checkmarkScale: CGFloat = 0.0
    @State private var checkmarkOpacity: Double = 0.0

    var body: some View {
        ZStack {
            Circle()
                .fill(complianceType.color.opacity(0.2))
                .frame(width: 60, height: 60)
                .scaleEffect(checkmarkScale)

            Image(systemName: "checkmark")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(complianceType.color)
                .opacity(checkmarkOpacity)
        }
        .onAppear {
            animateCheckmark()
        }
    }

    private func animateCheckmark() {
        // Scale up circle
        withAnimation(
            TrustMotionConfig.bouncySpring
        ) {
            checkmarkScale = 1.2
        }

        // Show checkmark
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.easeOut(duration: 0.3)) {
                checkmarkOpacity = 1.0
            }
        }

        // Settle
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            withAnimation(TrustMotionConfig.smoothSpring) {
                checkmarkScale = 1.0
            }
        }
    }
}

extension View {
    /// Adds compliance bloom (green ripple) for good compliance
    func complianceBloom(type: ComplianceBloom.ComplianceType) -> some View {
        overlay(
            ComplianceBloom(complianceType: type)
                .allowsHitTesting(false)
        )
    }

    /// Adds compliance checkmark animation
    func complianceCheckmark(type: ComplianceBloom.ComplianceType) -> some View {
        overlay(
            ComplianceCheckmark(complianceType: type)
                .allowsHitTesting(false)
        )
    }
}

