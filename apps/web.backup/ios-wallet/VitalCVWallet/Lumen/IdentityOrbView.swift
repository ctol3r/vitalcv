// IdentityOrbView.swift

// The core identity orb renderer scaffold

import SwiftUI

struct IdentityOrbView: View {
    @EnvironmentObject var lumen: LumenContext

    @State private var breathing: Bool = false
    @State private var rotation: Angle = .degrees(0)

    var body: some View {
        let trust = lumen.trustNormalized
        let color = Color.lumenTrustColor(trust: trust)

        ZStack {
            // Outer glow aura
            Circle()
                .fill(Color.clear)
                .lumenGlow(color: color, radius: 30, opacity: 0.8)
                .scaleEffect(breathing ? 1.1 : 1.0)

            // Core orb
            Circle()
                .fill(
                    RadialGradient(colors: [
                        color.opacity(0.9),
                        Color.black.opacity(0.95)
                    ], center: .center, startRadius: 4, endRadius: 60)
                )
                .overlay(
                    // Light highlight
                    Circle()
                        .strokeBorder(Color.white.opacity(0.15), lineWidth: 1.5)
                        .blur(radius: 2)
                        .offset(x: -10, y: -12)
                        .mask(Circle())
                )
                .rotationEffect(rotation)
        }
        .frame(width: 120, height: 120)
        .onAppear {
            breathing = true
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                rotation = .degrees(360)
            }
        }
        .onTapGesture {
            lumen.triggerTrustPulse()
        }
        .accessibilityLabel("Identity orb, trust \(Int(trust * 100)) percent")
    }
}

struct IdentityOrbView_Previews: PreviewProvider {
    static var previews: some View {
        IdentityOrbView()
            .environmentObject(LumenContext())
            .padding()
            .background(Color.black)
            .preferredColorScheme(.dark)
    }
}

