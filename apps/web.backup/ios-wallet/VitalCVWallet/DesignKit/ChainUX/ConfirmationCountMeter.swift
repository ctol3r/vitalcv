//
//  ConfirmationCountMeter.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 7
//  Confirmation count meter (1–12 confirmed visual)
//

import SwiftUI

/// ConfirmationCountMeter - Visual meter showing confirmation count (1-12)
struct ConfirmationCountMeter: View {
    let confirmations: Int
    let maxConfirmations: Int
    let style: MeterStyle

    enum MeterStyle {
        case bars
        case circular
        case dots
    }

    init(
        confirmations: Int,
        maxConfirmations: Int = 12,
        style: MeterStyle = .bars
    ) {
        self.confirmations = min(confirmations, maxConfirmations)
        self.maxConfirmations = maxConfirmations
        self.style = style
    }

    var body: some View {
        switch style {
        case .bars:
            BarsConfirmationMeter(
                confirmations: confirmations,
                maxConfirmations: maxConfirmations
            )
        case .circular:
            CircularConfirmationMeter(
                confirmations: confirmations,
                maxConfirmations: maxConfirmations
            )
        case .dots:
            DotsConfirmationMeter(
                confirmations: confirmations,
                maxConfirmations: maxConfirmations
            )
        }
    }

    private var confirmationColor: Color {
        if confirmations >= 12 {
            return ChainColorPalette.emerald
        } else if confirmations >= 6 {
            return ChainColorPalette.emerald.opacity(0.8)
        } else if confirmations >= 3 {
            return ChainColorPalette.amber
        } else {
            return ChainColorPalette.glacialBlue
        }
    }
}

// MARK: - Bars Style

struct BarsConfirmationMeter: View {
    let confirmations: Int
    let maxConfirmations: Int

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<maxConfirmations, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(index < confirmations ? confirmationColor(for: index) : Color.gray.opacity(0.2))
                    .frame(width: 8, height: barHeight(for: index))
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: confirmations)
            }
        }
        .frame(height: 40)
    }

    private func barHeight(for index: Int) -> CGFloat {
        let baseHeight: CGFloat = 8
        let increment: CGFloat = 2.5
        return baseHeight + CGFloat(index) * increment
    }

    private func confirmationColor(for index: Int) -> Color {
        if index >= 12 {
            return ChainColorPalette.emerald
        } else if index >= 6 {
            return ChainColorPalette.emerald.opacity(0.8)
        } else if index >= 3 {
            return ChainColorPalette.amber
        } else {
            return ChainColorPalette.glacialBlue
        }
    }
}

// MARK: - Circular Style

struct CircularConfirmationMeter: View {
    let confirmations: Int
    let maxConfirmations: Int

    var body: some View {
        ZStack {
            // Background circle
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 8)

            // Progress circle
            Circle()
                .trim(from: 0, to: CGFloat(confirmations) / CGFloat(maxConfirmations))
                .stroke(
                    confirmationColor,
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: confirmations)

            // Center text
            VStack(spacing: 2) {
                Text("\(confirmations)")
                    .font(WalletTypography.headline)
                    .foregroundColor(confirmationColor)

                Text("/\(maxConfirmations)")
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .frame(width: 80, height: 80)
    }

    private var confirmationColor: Color {
        if confirmations >= 12 {
            return ChainColorPalette.emerald
        } else if confirmations >= 6 {
            return ChainColorPalette.emerald.opacity(0.8)
        } else if confirmations >= 3 {
            return ChainColorPalette.amber
        } else {
            return ChainColorPalette.glacialBlue
        }
    }
}

// MARK: - Dots Style

struct DotsConfirmationMeter: View {
    let confirmations: Int
    let maxConfirmations: Int

    private let columns = 4

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: columns), spacing: 4) {
            ForEach(0..<maxConfirmations, id: \.self) { index in
                Circle()
                    .fill(index < confirmations ? confirmationColor(for: index) : Color.gray.opacity(0.2))
                    .frame(width: 8, height: 8)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: confirmations)
            }
        }
        .frame(width: 80)
    }

    private func confirmationColor(for index: Int) -> Color {
        if index >= 12 {
            return ChainColorPalette.emerald
        } else if index >= 6 {
            return ChainColorPalette.emerald.opacity(0.8)
        } else if index >= 3 {
            return ChainColorPalette.amber
        } else {
            return ChainColorPalette.glacialBlue
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 24) {
        VStack(spacing: 8) {
            Text("Bars Style")
                .font(WalletTypography.headline)
            ConfirmationCountMeter(confirmations: 5, style: .bars)
        }

        VStack(spacing: 8) {
            Text("Circular Style")
                .font(WalletTypography.headline)
            ConfirmationCountMeter(confirmations: 8, style: .circular)
        }

        VStack(spacing: 8) {
            Text("Dots Style")
                .font(WalletTypography.headline)
            ConfirmationCountMeter(confirmations: 12, style: .dots)
        }
    }
    .padding()
}








