//
//  ChainRippleViewModifier.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 4
//  Chain ripple modifier (pulse on confirmation)
//

import SwiftUI

/// ChainRippleViewModifier - Adds pulsing ripple effect for chain confirmations
struct ChainRippleViewModifier: ViewModifier {
    @State private var rippleScale: CGFloat = 1.0
    @State private var rippleOpacity: Double = 0.0

    let color: Color
    let isActive: Bool
    let pulseCount: Int
    let duration: Double

    init(
        color: Color = ChainColorPalette.emerald,
        isActive: Bool = true,
        pulseCount: Int = 3,
        duration: Double = 1.5
    ) {
        self.color = color
        self.isActive = isActive
        self.pulseCount = pulseCount
        self.duration = duration
    }

    func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if isActive {
                        ZStack {
                            ForEach(0..<pulseCount, id: \.self) { index in
                                Circle()
                                    .stroke(color, lineWidth: 2)
                                    .frame(width: 80, height: 80)
                                    .scaleEffect(rippleScale)
                                    .opacity(rippleOpacity)
                                    .animation(
                                        Animation.easeOut(duration: duration)
                                            .repeatForever(autoreverses: false)
                                            .delay(Double(index) * 0.3),
                                        value: rippleScale
                                    )
                            }
                        }
                        .onAppear {
                            rippleScale = 2.0
                            rippleOpacity = 0.0
                        }
                    }
                }
            )
    }
}

extension View {
    /// Apply chain ripple effect
    func chainRipple(
        color: Color = ChainColorPalette.emerald,
        isActive: Bool = true,
        pulseCount: Int = 3,
        duration: Double = 1.5
    ) -> some View {
        modifier(ChainRippleViewModifier(
            color: color,
            isActive: isActive,
            pulseCount: pulseCount,
            duration: duration
        ))
    }
}








