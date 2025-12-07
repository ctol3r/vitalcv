//
//  ChainSignalStrengthMeter.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 23
//  Chain signal strength meter
//

import SwiftUI

/// ChainSignalStrengthMeter - Visual meter for chain connection strength
struct ChainSignalStrengthMeter: View {
    @ObservedObject var chainMonitor = MobileChainMonitor.shared
    var style: MeterStyle = .bars
    var showLabel: Bool = true

    enum MeterStyle {
        case bars
        case circular
        case wave
    }

    private var signalStrength: Double {
        chainMonitor.signalStrength
    }

    private var signalLevel: SignalLevel {
        if signalStrength >= 0.8 {
            return .excellent
        } else if signalStrength >= 0.6 {
            return .good
        } else if signalStrength >= 0.4 {
            return .fair
        } else if signalStrength > 0 {
            return .poor
        } else {
            return .disconnected
        }
    }

    private var signalColor: Color {
        switch signalLevel {
        case .excellent, .good:
            return .walletSuccess
        case .fair:
            return .walletWarning
        case .poor, .disconnected:
            return .walletError
        }
    }

    private var signalLabel: String {
        switch signalLevel {
        case .excellent: return "Excellent"
        case .good: return "Good"
        case .fair: return "Fair"
        case .poor: return "Poor"
        case .disconnected: return "Disconnected"
        }
    }

    enum SignalLevel {
        case excellent
        case good
        case fair
        case poor
        case disconnected
    }

    var body: some View {
        VStack(spacing: 8) {
            if showLabel {
                HStack {
                    Text("Chain Signal")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)

                    Spacer()

                    if let latency = chainMonitor.chainLatency {
                        Text("\(Int(latency))ms")
                            .font(WalletTypography.caption)
                            .foregroundColor(signalColor)
                    }
                }
            }

            switch style {
            case .bars:
                BarsSignalMeter(signalStrength: signalStrength, color: signalColor)
            case .circular:
                CircularSignalMeter(signalStrength: signalStrength, color: signalColor)
            case .wave:
                WaveSignalMeter(signalStrength: signalStrength, color: signalColor)
            }

            if showLabel {
                Text(signalLabel)
                    .font(WalletTypography.caption)
                    .foregroundColor(signalColor)
            }
        }
    }
}

// MARK: - Bars Signal Meter

struct BarsSignalMeter: View {
    let signalStrength: Double
    let color: Color

    private let barCount = 5

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(0..<barCount, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(index < Int(signalStrength * Double(barCount)) ? color : Color.gray.opacity(0.3))
                    .frame(width: 8, height: barHeight(for: index))
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: signalStrength)
            }
        }
        .frame(height: 40)
    }

    private func barHeight(for index: Int) -> CGFloat {
        let baseHeight: CGFloat = 8
        let increment: CGFloat = 6
        return baseHeight + CGFloat(index) * increment
    }
}

// MARK: - Circular Signal Meter

struct CircularSignalMeter: View {
    let signalStrength: Double
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 8)

            Circle()
                .trim(from: 0, to: signalStrength)
                .stroke(
                    color,
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: signalStrength)

            VStack(spacing: 2) {
                Text("\(Int(signalStrength * 100))%")
                    .font(WalletTypography.headline)
                    .foregroundColor(color)

                Text("signal")
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .frame(width: 80, height: 80)
    }
}

// MARK: - Wave Signal Meter

struct WaveSignalMeter: View {
    let signalStrength: Double
    let color: Color

    @State private var wavePhase: Double = 0

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                let width = geometry.size.width
                let height = geometry.size.height
                let amplitude = height * 0.3 * signalStrength
                let frequency = 2.0

                path.move(to: CGPoint(x: 0, y: height / 2))

                for x in stride(from: 0, through: width, by: 1) {
                    let y = height / 2 + amplitude * sin((Double(x) / width * frequency * 2 * .pi) + wavePhase)
                    path.addLine(to: CGPoint(x: x, y: y))
                }
            }
            .stroke(color, lineWidth: 2)
        }
        .frame(height: 40)
        .onAppear {
            withAnimation(
                Animation.linear(duration: 2.0)
                    .repeatForever(autoreverses: false)
            ) {
                wavePhase = .pi * 2
            }
        }
    }
}








