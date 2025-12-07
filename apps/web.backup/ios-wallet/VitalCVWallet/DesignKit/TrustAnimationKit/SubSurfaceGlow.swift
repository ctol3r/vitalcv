//
//  SubSurfaceGlow.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 2, Task 12
//  Sub-surface glow effect for identity orb
//

import SwiftUI

/// SubSurfaceGlow - Inner glow effect for identity orbs
struct SubSurfaceGlow: ViewModifier {
    let intensity: Double
    let color: Color
    @State private var glowPhase: Double = 0.0

    init(
        intensity: Double = 0.6,
        color: Color = .trustEmerald
    ) {
        self.intensity = intensity
        self.color = color
    }

    func body(content: Content) -> some View {
        content
            .overlay(
                // Inner glow layer
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                color.opacity(glowOpacity),
                                color.opacity(glowOpacity * 0.5),
                                Color.clear
                            ],
                            center: UnitPoint(x: 0.3, y: 0.3),
                            startRadius: 10,
                            endRadius: 50
                        )
                    )
                    .blendMode(.overlay)
                    .blur(radius: 5)
            )
            .overlay(
                // Secondary inner glow
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                color.opacity(glowOpacity * 0.4),
                                Color.clear
                            ],
                            center: UnitPoint(x: 0.7, y: 0.7),
                            startRadius: 5,
                            endRadius: 30
                        )
                    )
                    .blendMode(.softLight)
                    .blur(radius: 3)
            )
            .onAppear {
                startAnimation()
            }
    }

    private var glowOpacity: Double {
        let baseOpacity = intensity * 0.5
        let oscillation = sin(glowPhase * .pi * 2) * 0.15
        return baseOpacity + oscillation
    }

    private func startAnimation() {
        withAnimation(
            Animation.easeInOut(duration: 3.0)
                .repeatForever(autoreverses: true)
        ) {
            glowPhase = 1.0
        }
    }
}

/// IdentityOrb - Complete identity orb with sub-surface glow
struct IdentityOrb: View {
    let trustScore: Double // 0-100
    let size: CGFloat
    @State private var rotation: Double = 0.0

    var body: some View {
        ZStack {
            // Base orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: orbColors,
                        center: .center,
                        startRadius: 0,
                        endRadius: size / 2
                    )
                )
                .frame(width: size, height: size)

            // Sub-surface glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            orbColor.opacity(0.6),
                            orbColor.opacity(0.2),
                            Color.clear
                        ],
                        center: UnitPoint(x: 0.3, y: 0.3),
                        startRadius: size * 0.1,
                        endRadius: size * 0.5
                    )
                )
                .blendMode(.overlay)
                .blur(radius: size * 0.05)

            // Inner highlight
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.white.opacity(0.4),
                            Color.clear
                        ],
                        center: UnitPoint(x: 0.25, y: 0.25),
                        startRadius: 0,
                        endRadius: size * 0.3
                    )
                )
                .blendMode(.overlay)
        }
        .modifier(SubSurfaceGlow(
            intensity: trustScore / 100.0,
            color: orbColor
        ))
        .rotationEffect(.degrees(rotation))
        .onAppear {
            withAnimation(
                Animation.linear(duration: 20.0)
                    .repeatForever(autoreverses: false)
            ) {
                rotation = 360.0
            }
        }
    }

    private var orbColor: Color {
        if trustScore >= 80 {
            return .trustEmerald
        } else if trustScore >= 60 {
            return .trustAmber
        } else {
            return .trustRose
        }
    }

    private var orbColors: [Color] {
        [
            orbColor.opacity(0.9),
            orbColor.opacity(0.7),
            orbColor.opacity(0.5)
        ]
    }
}

extension View {
    /// Adds sub-surface glow effect
    func subSurfaceGlow(
        intensity: Double = 0.6,
        color: Color = .trustEmerald
    ) -> some View {
        modifier(SubSurfaceGlow(
            intensity: intensity,
            color: color
        ))
    }
}

