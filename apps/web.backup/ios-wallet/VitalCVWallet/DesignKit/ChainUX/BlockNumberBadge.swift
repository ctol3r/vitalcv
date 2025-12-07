//
//  BlockNumberBadge.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 6
//  Block number badge (tiny, readable)
//

import SwiftUI

/// BlockNumberBadge - Displays block number in a compact, readable format
struct BlockNumberBadge: View {
    let blockNumber: UInt64?
    let style: BadgeStyle

    enum BadgeStyle {
        case compact    // Just number
        case full       // "Block #12345"
        case short      // "#12345"
    }

    init(blockNumber: UInt64?, style: BadgeStyle = .compact) {
        self.blockNumber = blockNumber
        self.style = style
    }

    var body: some View {
        if let blockNumber = blockNumber {
            HStack(spacing: 4) {
                Image(systemName: "cube.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.chainEmerald)

                Text(blockNumberText)
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextPrimary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(Color.walletCard)
                    .overlay(
                        Capsule()
                            .stroke(ChainColorPalette.emerald.opacity(0.3), lineWidth: 1)
                    )
            )
        } else {
            EmptyView()
        }
    }

    private var blockNumberText: String {
        guard let blockNumber = blockNumber else { return "" }

        switch style {
        case .compact:
            return formatBlockNumber(blockNumber)
        case .full:
            return "Block \(formatBlockNumber(blockNumber))"
        case .short:
            return "#\(formatBlockNumber(blockNumber))"
        }
    }

    private func formatBlockNumber(_ number: UInt64) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        BlockNumberBadge(blockNumber: 12345678, style: .compact)
        BlockNumberBadge(blockNumber: 12345678, style: .full)
        BlockNumberBadge(blockNumber: 12345678, style: .short)
        BlockNumberBadge(blockNumber: nil, style: .compact)
    }
    .padding()
}








