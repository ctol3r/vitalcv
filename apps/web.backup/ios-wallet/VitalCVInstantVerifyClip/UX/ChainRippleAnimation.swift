//
//  ChainRippleAnimation.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 4 - Task 29
//  Chain ripple micro-animation for anchor success
//

import SwiftUI

struct ChainRippleAnimation: View {
    @State private var rippleScale: CGFloat = 0.5
    @State private var rippleOpacity: Double = 1.0

    var body: some View {
        ZStack {
            ForEach(0..<3) { index in
                Circle()
                    .stroke(Color.green, lineWidth: 2)
                    .frame(width: 80, height: 80)
                    .scaleEffect(rippleScale)
                    .opacity(rippleOpacity)
                    .animation(
                        Animation.easeOut(duration: 1.5)
                            .repeatForever(autoreverses: false)
                            .delay(Double(index) * 0.3),
                        value: rippleScale
                    )
            }

            Image(systemName: "link.circle.fill")
                .font(.system(size: 40))
                .foregroundColor(.green)
        }
        .onAppear {
            rippleScale = 2.0
            rippleOpacity = 0.0
        }
    }
}




