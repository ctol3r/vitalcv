//
//  ChainRipple.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 17
//  Chain ripple animation (circles spreading outward on anchor success)
//

import SwiftUI

/// ChainRipple - Circles spreading outward on anchor success
struct ChainRipple: View {
    let color: Color
    let rippleCount: Int
    @State private var ripples: [RippleState] = []

    struct RippleState: Identifiable {
        let id: UUID
        var scale: CGFloat
        var opacity: Double
    }

    init(color: Color = .trustEmerald, rippleCount: Int = 4) {
        self.color = color
        self.rippleCount = rippleCount
    }

    var body: some View {
        ZStack {
            ForEach(ripples) { ripple in
                Circle()
                    .stroke(
                        color.opacity(ripple.opacity),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                    .frame(width: 100, height: 100)
                    .scaleEffect(ripple.scale)
            }
        }
        .onAppear {
            generateRipples()
        }
    }

    private func generateRipples() {
        for i in 0..<rippleCount {
            let ripple = RippleState(
                id: UUID(),
                scale: 0.5,
                opacity: 0.8
            )

            ripples.append(ripple)

            // Animate each ripple with delay
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.2) {
                animateRipple(id: ripple.id)
            }
        }
    }

    private func animateRipple(id: UUID) {
        guard let index = ripples.firstIndex(where: { $0.id == id }) else { return }

        withAnimation(
            Animation.easeOut(duration: 1.5)
                .repeatForever(autoreverses: false)
        ) {
            ripples[index].scale = 3.0
            ripples[index].opacity = 0.0
        }
    }

    func trigger() {
        // Reset and regenerate ripples
        ripples.removeAll()
        generateRipples()
    }
}

/// ChainRippleSequence - Sequential ripple animation
struct ChainRippleSequence: View {
    let confirmationCount: Int
    @State private var currentRipple: Int = 0
    @State private var ripples: [RippleState] = []

    struct RippleState: Identifiable {
        let id: UUID
        let index: Int
        var scale: CGFloat
        var opacity: Double
        var isActive: Bool
    }

    var body: some View {
        ZStack {
            ForEach(ripples) { ripple in
                Circle()
                    .stroke(
                        TrustColorPalette.emerald500.opacity(ripple.opacity),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round)
                    )
                    .frame(width: 120, height: 120)
                    .scaleEffect(ripple.scale)
            }
        }
        .onAppear {
            initializeRipples()
        }
    }

    private func initializeRipples() {
        for i in 0..<confirmationCount {
            let ripple = RippleState(
                id: UUID(),
                index: i,
                scale: 0.0,
                opacity: 0.0,
                isActive: false
            )
            ripples.append(ripple)
        }
    }

    func triggerRipple(at index: Int) {
        guard index < ripples.count else { return }

        ripples[index].isActive = true
        ripples[index].scale = 0.5
        ripples[index].opacity = 0.8

        withAnimation(TrustMotionConfig.chainRipple) {
            ripples[index].scale = 2.5
            ripples[index].opacity = 0.0
        }
    }
}

extension View {
    /// Adds chain ripple animation
    func chainRipple(color: Color = .trustEmerald, count: Int = 4) -> some View {
        overlay(
            ChainRipple(color: color, rippleCount: count)
                .allowsHitTesting(false)
        )
    }
}

