//
//  TrustPulseView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 4 - Task 28
//  Trust pulse animation when verification step completes
//

import SwiftUI

struct TrustPulseView: View {
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 0.5

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.walletPrimary.opacity(pulseOpacity))
                .frame(width: 100, height: 100)
                .scaleEffect(pulseScale)

            Circle()
                .fill(Color.walletPrimary)
                .frame(width: 60, height: 60)
        }
        .onAppear {
            withAnimation(
                Animation.easeInOut(duration: 1.0)
                    .repeatForever(autoreverses: true)
            ) {
                pulseScale = 1.3
                pulseOpacity = 0.1
            }
        }
    }
}




