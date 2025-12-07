//
//  TrustHorizon.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 39
//  Trust horizon gradient behind verification result
//

import SwiftUI

/// TrustHorizon - Gradient horizon behind verification result
struct TrustHorizon: View {
    let state: TrustState
    let trustScore: Double

    var body: some View {
        ZStack {
            // Base gradient
            LinearGradient(
                colors: horizonColors,
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Horizon line
            Path { path in
                path.move(to: CGPoint(x: 0, y: horizonPosition))
                path.addLine(to: CGPoint(x: UIScreen.main.bounds.width, y: horizonPosition))
            }
            .stroke(
                horizonLineColor.opacity(0.3),
                style: StrokeStyle(lineWidth: 2, lineCap: .round)
            )

            // Atmospheric glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            horizonColors.first?.opacity(0.4) ?? .clear,
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: 200
                    )
                )
                .frame(width: 400, height: 400)
                .position(x: UIScreen.main.bounds.width / 2, y: horizonPosition)
                .blur(radius: 50)
        }
    }

    private var horizonPosition: CGFloat {
        UIScreen.main.bounds.height * 0.6
    }

    private var horizonColors: [Color] {
        switch state {
        case .passed:
            return [
                TrustColorPalette.emerald900.opacity(0.3),
                TrustColorPalette.emerald700.opacity(0.2),
                TrustColorPalette.emerald500.opacity(0.1),
                Color.walletBackground
            ]
        case .warning:
            return [
                TrustColorPalette.amber900.opacity(0.3),
                TrustColorPalette.amber700.opacity(0.2),
                TrustColorPalette.amber500.opacity(0.1),
                Color.walletBackground
            ]
        case .failed:
            return [
                TrustColorPalette.rose900.opacity(0.3),
                TrustColorPalette.rose700.opacity(0.2),
                TrustColorPalette.rose500.opacity(0.1),
                Color.walletBackground
            ]
        case .verifying:
            return [
                TrustColorPalette.indigo900.opacity(0.3),
                TrustColorPalette.indigo700.opacity(0.2),
                TrustColorPalette.indigo500.opacity(0.1),
                Color.walletBackground
            ]
        case .idle:
            return [
                Color.walletTextSecondary.opacity(0.1),
                Color.walletBackground
            ]
        }
    }

    private var horizonLineColor: Color {
        TrustColorPalette.color(for: state, intensity: 0.6)
    }
}

extension View {
    /// Adds trust horizon gradient behind verification result
    func trustHorizon(state: TrustState, trustScore: Double = 0.0) -> some View {
        ZStack {
            TrustHorizon(state: state, trustScore: trustScore)
            self
        }
    }
}

