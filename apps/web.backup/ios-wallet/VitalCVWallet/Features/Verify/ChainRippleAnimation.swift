//
//  ChainRippleAnimation.swift
//  VitalCVWallet
//
//  Created: Phase 5 - Task 36
//  Add chain ripple animation when anchor is validated
//

import SwiftUI

struct ChainRippleAnimation: View {
    @State private var rippleScale: CGFloat = 1.0
    @State private var rippleOpacity: Double = 1.0
    @State private var isAnimating: Bool = false

    var body: some View {
        ZStack {
            ForEach(0..<3) { index in
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.green.opacity(0.8),
                                Color.blue.opacity(0.4),
                                Color.clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 3
                    )
                    .frame(width: 100, height: 100)
                    .scaleEffect(rippleScale + CGFloat(index) * 0.3)
                    .opacity(rippleOpacity - Double(index) * 0.2)
                    .animation(
                        Animation.easeOut(duration: 1.5)
                            .repeatCount(3, autoreverses: false)
                            .delay(Double(index) * 0.2),
                        value: rippleScale
                    )
            }
        }
        .onAppear {
            startAnimation()
        }
    }

    func startAnimation() {
        guard !isAnimating else { return }
        isAnimating = true

        withAnimation {
            rippleScale = 2.5
            rippleOpacity = 0.0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            rippleScale = 1.0
            rippleOpacity = 1.0
            isAnimating = false
        }
    }
}

