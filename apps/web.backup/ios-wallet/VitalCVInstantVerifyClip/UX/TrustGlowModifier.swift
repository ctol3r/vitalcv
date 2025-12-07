//
//  TrustGlowModifier.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 4 - Task 27
//  Simplified trustGlow (one-layer blur) for App Clip
//

import SwiftUI

struct TrustGlowModifier: ViewModifier {
    let intensity: Double
    let color: Color

    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(intensity * 0.3), radius: 20, x: 0, y: 0)
            .blur(radius: intensity * 2)
    }
}

extension View {
    func trustGlow(intensity: Double = 1.0, color: Color = .walletPrimary) -> some View {
        modifier(TrustGlowModifier(intensity: intensity, color: color))
    }
}




