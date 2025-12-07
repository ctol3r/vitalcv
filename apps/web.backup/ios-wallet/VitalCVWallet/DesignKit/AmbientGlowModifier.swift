//
//  AmbientGlowModifier.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 7
//  Ambient glow modifier for trust-light visuals
//

import SwiftUI

/// AmbientGlowModifier - Creates trust-light glow effects
struct AmbientGlowModifier: ViewModifier {
    var intensity: Double
    var color: Color
    var radius: CGFloat
    var animated: Bool

    @State private var glowPhase: Double = 0

    init(
        intensity: Double = 0.5,
        color: Color = .walletPrimary,
        radius: CGFloat = 20,
        animated: Bool = true
    ) {
        self.intensity = intensity
        self.color = color
        self.radius = radius
        self.animated = animated
    }

    func body(content: Content) -> some View {
        content
            .shadow(
                color: color.opacity(intensity * (animated ? (0.5 + 0.5 * sin(glowPhase)) : 1.0)),
                radius: radius,
                x: 0,
                y: 0
            )
            .shadow(
                color: color.opacity(intensity * 0.5 * (animated ? (0.5 + 0.5 * sin(glowPhase + .pi / 2)) : 1.0)),
                radius: radius * 1.5,
                x: 0,
                y: 0
            )
            .onAppear {
                if animated {
                    withAnimation(
                        Animation.easeInOut(duration: 2.0)
                            .repeatForever(autoreverses: false)
                    ) {
                        glowPhase = .pi * 2
                    }
                }
            }
    }
}

// MARK: - Trust-Level Glow Modifier

struct TrustGlowModifier: ViewModifier {
    var trustLevel: TrustLevel
    var intensity: Double
    var animated: Bool

    enum TrustLevel {
        case high
        case medium
        case low
        case unknown

        var color: Color {
            switch self {
            case .high: return .walletSuccess
            case .medium: return .walletWarning
            case .low: return .walletError
            case .unknown: return .walletTextSecondary
            }
        }

        var defaultIntensity: Double {
            switch self {
            case .high: return 0.6
            case .medium: return 0.4
            case .low: return 0.3
            case .unknown: return 0.2
            }
        }
    }

    init(
        trustLevel: TrustLevel,
        intensity: Double? = nil,
        animated: Bool = true
    ) {
        self.trustLevel = trustLevel
        self.intensity = intensity ?? trustLevel.defaultIntensity
        self.animated = animated
    }

    func body(content: Content) -> some View {
        content
            .modifier(AmbientGlowModifier(
                intensity: intensity,
                color: trustLevel.color,
                radius: 25,
                animated: animated
            ))
    }
}

// MARK: - Multi-Layer Glow Modifier

struct MultiLayerGlowModifier: ViewModifier {
    var layers: [GlowLayer]
    var animated: Bool

    struct GlowLayer {
        var color: Color
        var intensity: Double
        var radius: CGFloat
        var offset: CGSize

        init(
            color: Color,
            intensity: Double = 0.3,
            radius: CGFloat = 20,
            offset: CGSize = .zero
        ) {
            self.color = color
            self.intensity = intensity
            self.radius = radius
            self.offset = offset
        }
    }

    @State private var glowPhase: Double = 0

    init(layers: [GlowLayer], animated: Bool = true) {
        self.layers = layers
        self.animated = animated
    }

    func body(content: Content) -> some View {
        let baseView = content

        layers.enumerated().reduce(baseView) { view, index in
            let layer = index.element
            let phaseOffset = Double(index.offset) * .pi / 4

            return view
                .shadow(
                    color: layer.color.opacity(
                        layer.intensity * (animated ? (0.5 + 0.5 * sin(glowPhase + phaseOffset)) : 1.0)
                    ),
                    radius: layer.radius,
                    x: layer.offset.width,
                    y: layer.offset.height
                )
        }
        .onAppear {
            if animated {
                withAnimation(
                    Animation.easeInOut(duration: 3.0)
                        .repeatForever(autoreverses: false)
                ) {
                    glowPhase = .pi * 2
                }
            }
        }
    }
}

// MARK: - View Extensions

extension View {
    /// Apply ambient glow effect
    func ambientGlow(
        intensity: Double = 0.5,
        color: Color = .walletPrimary,
        radius: CGFloat = 20,
        animated: Bool = true
    ) -> some View {
        modifier(AmbientGlowModifier(
            intensity: intensity,
            color: color,
            radius: radius,
            animated: animated
        ))
    }

    /// Apply trust-level glow
    func trustGlow(
        level: TrustGlowModifier.TrustLevel,
        intensity: Double? = nil,
        animated: Bool = true
    ) -> some View {
        modifier(TrustGlowModifier(
            trustLevel: level,
            intensity: intensity,
            animated: animated
        ))
    }

    /// Apply multi-layer glow
    func multiLayerGlow(
        layers: [MultiLayerGlowModifier.GlowLayer],
        animated: Bool = true
    ) -> some View {
        modifier(MultiLayerGlowModifier(layers: layers, animated: animated))
    }
}

// MARK: - Preset Glow Configurations

extension MultiLayerGlowModifier.GlowLayer {
    /// High trust glow (green layers)
    static var highTrust: [MultiLayerGlowModifier.GlowLayer] {
        [
            MultiLayerGlowModifier.GlowLayer(
                color: .walletSuccess,
                intensity: 0.4,
                radius: 15,
                offset: .zero
            ),
            MultiLayerGlowModifier.GlowLayer(
                color: .walletSuccess.opacity(0.6),
                intensity: 0.3,
                radius: 30,
                offset: CGSize(width: 5, height: 5)
            ),
            MultiLayerGlowModifier.GlowLayer(
                color: .walletSuccess.opacity(0.4),
                intensity: 0.2,
                radius: 45,
                offset: CGSize(width: -5, height: -5)
            )
        ]
    }

    /// Medium trust glow (yellow layers)
    static var mediumTrust: [MultiLayerGlowModifier.GlowLayer] {
        [
            MultiLayerGlowModifier.GlowLayer(
                color: .walletWarning,
                intensity: 0.3,
                radius: 12,
                offset: .zero
            ),
            MultiLayerGlowModifier.GlowLayer(
                color: .walletWarning.opacity(0.5),
                intensity: 0.2,
                radius: 25,
                offset: CGSize(width: 3, height: 3)
            )
        ]
    }

    /// Low trust glow (red layers)
    static var lowTrust: [MultiLayerGlowModifier.GlowLayer] {
        [
            MultiLayerGlowModifier.GlowLayer(
                color: .walletError,
                intensity: 0.25,
                radius: 10,
                offset: .zero
            )
        ]
    }
}








