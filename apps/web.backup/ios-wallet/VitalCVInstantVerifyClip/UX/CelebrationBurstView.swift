//
//  CelebrationBurstView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 4 - Task 32
//  "Candidate Verified" celebration burst
//

import SwiftUI

struct CelebrationBurstView: View {
    @State private var burstScale: CGFloat = 0.0
    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            // Burst particles
            ForEach(0..<8) { index in
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.system(size: 20))
                    .offset(x: cos(Double(index) * .pi / 4) * 60 * burstScale,
                           y: sin(Double(index) * .pi / 4) * 60 * burstScale)
                    .opacity(1.0 - Double(burstScale))
            }

            // Center checkmark
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.green)
                .scaleEffect(burstScale)
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.6)) {
                burstScale = 1.0
            }

            withAnimation(
                Animation.linear(duration: 2.0)
                    .repeatForever(autoreverses: false)
            ) {
                rotation = 360
            }
        }
    }
}




