//
//  OverscrollIdentityStretch.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 28
//  Identity orb elastic effect on overscroll
//

import SwiftUI

/// OverscrollIdentityStretch - Elastic stretch effect for identity orb
struct OverscrollIdentityStretch: ViewModifier {
    @State private var stretchAmount: CGFloat = 0
    @State private var rotation: Double = 0

    func body(content: Content) -> some View {
        content
            .scaleEffect(
                x: 1.0 + abs(stretchAmount) * 0.1,
                y: 1.0 - abs(stretchAmount) * 0.05
            )
            .rotationEffect(.degrees(rotation))
            .gesture(
                DragGesture()
                    .onChanged { value in
                        let dragAmount = value.translation.y
                        stretchAmount = max(-1.0, min(1.0, dragAmount / 100))
                        rotation = Double(dragAmount) * 0.1
                    }
                    .onEnded { _ in
                        withAnimation(TrustMotionConfig.bouncySpring) {
                            stretchAmount = 0
                            rotation = 0
                        }
                    }
            )
    }
}

/// ElasticIdentityOrb - Identity orb with elastic overscroll
struct ElasticIdentityOrb: View {
    let trustScore: Double
    @State private var stretchX: CGFloat = 1.0
    @State private var stretchY: CGFloat = 1.0
    @State private var rotation: Double = 0

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        TrustColorPalette.emerald500.opacity(0.9),
                        TrustColorPalette.emerald500.opacity(0.6)
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: 50
                )
            )
            .frame(width: 100, height: 100)
            .scaleEffect(x: stretchX, y: stretchY)
            .rotationEffect(.degrees(rotation))
            .gesture(
                DragGesture()
                    .onChanged { value in
                        let dragDistance = sqrt(pow(value.translation.width, 2) + pow(value.translation.height, 2))
                        let maxDrag: CGFloat = 150
                        let normalizedDrag = min(1.0, dragDistance / maxDrag)

                        // Elastic stretch
                        let elasticFactor: CGFloat = 0.15
                        let stretchAmount = normalizedDrag * elasticFactor

                        // Direction-based stretching
                        if abs(value.translation.width) > abs(value.translation.height) {
                            // Horizontal stretch
                            stretchX = 1.0 + stretchAmount
                            stretchY = 1.0 - stretchAmount * 0.5
                            rotation = Double(value.translation.width) * 0.1
                        } else {
                            // Vertical stretch
                            stretchY = 1.0 + stretchAmount
                            stretchX = 1.0 - stretchAmount * 0.5
                            rotation = Double(value.translation.height) * 0.1
                        }
                    }
                    .onEnded { _ in
                        // Snap back with bounce
                        withAnimation(TrustMotionConfig.bouncySpring) {
                            stretchX = 1.0
                            stretchY = 1.0
                            rotation = 0
                        }
                    }
            )
    }
}

/// StretchableIdentityView - Complete stretchable identity view
struct StretchableIdentityView: View {
    let trustScore: Double
    @State private var scrollOffset: CGFloat = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                ElasticIdentityOrb(trustScore: trustScore)
                    .padding(.top, 40)

                // Content
                ForEach(0..<10) { _ in
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.walletCard)
                        .frame(height: 80)
                }
            }
            .padding()
            .background(
                GeometryReader { geometry in
                    Color.clear
                        .preference(
                            key: ScrollOffsetPreferenceKey.self,
                            value: geometry.frame(in: .named("scroll")).minY
                        )
                }
            )
        }
        .coordinateSpace(name: "scroll")
        .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
            scrollOffset = value
        }
    }
}

struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

extension View {
    /// Adds overscroll identity stretch (elastic effect)
    func overscrollIdentityStretch() -> some View {
        modifier(OverscrollIdentityStretch())
    }
}

