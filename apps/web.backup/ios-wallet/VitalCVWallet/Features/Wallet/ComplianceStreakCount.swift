//
//  ComplianceStreakCount.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 24
//  Compliance streak count (days continuously compliant)
//

import SwiftUI

/// ComplianceStreakCount - Shows days of continuous compliance
struct ComplianceStreakCount: View {
    let streakDays: Int
    var showLabel: Bool = true
    var style: StreakStyle = .badge

    enum StreakStyle {
        case badge
        case card
        case compact
    }

    private var streakLevel: StreakLevel {
        if streakDays >= 365 {
            return .legendary
        } else if streakDays >= 180 {
            return .excellent
        } else if streakDays >= 90 {
            return .great
        } else if streakDays >= 30 {
            return .good
        } else {
            return .beginner
        }
    }

    private var streakColor: Color {
        switch streakLevel {
        case .legendary:
            return Color(red: 0.8, green: 0.4, blue: 0.9) // Purple
        case .excellent:
            return .walletSuccess
        case .great:
            return Color(red: 0.2, green: 0.7, blue: 0.9) // Cyan
        case .good:
            return .walletWarning
        case .beginner:
            return .walletTextSecondary
        }
    }

    private var streakEmoji: String {
        switch streakLevel {
        case .legendary: return "🔥"
        case .excellent: return "⭐"
        case .great: return "✨"
        case .good: return "✓"
        case .beginner: return "🌱"
        }
    }

    var body: some View {
        switch style {
        case .badge:
            badgeView
        case .card:
            cardView
        case .compact:
            compactView
        }
    }

    private var badgeView: some View {
        HStack(spacing: WalletSpacing.sm) {
            Text(streakEmoji)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text("\(streakDays)")
                    .font(WalletTypography.title2)
                    .foregroundColor(streakColor)
                    .bold()

                if showLabel {
                    Text("day streak")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }
            }
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(streakColor.opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .stroke(streakColor.opacity(0.3), lineWidth: 1)
        )
    }

    private var cardView: some View {
        VStack(spacing: WalletSpacing.md) {
            Text(streakEmoji)
                .font(.system(size: 48))

            VStack(spacing: WalletSpacing.xs) {
                Text("\(streakDays)")
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(streakColor)
                    .bold()

                Text("Days Compliant")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Text(streakLevel.description)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(WalletSpacing.lg)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .overlay(
            RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                .stroke(
                    LinearGradient(
                        colors: [streakColor.opacity(0.5), streakColor.opacity(0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 2
                )
        )
        .walletShadow(WalletShadow.medium)
    }

    private var compactView: some View {
        HStack(spacing: WalletSpacing.xs) {
            Text(streakEmoji)
                .font(.caption)

            Text("\(streakDays)")
                .font(WalletTypography.caption)
                .foregroundColor(streakColor)
                .bold()
        }
    }
}

enum StreakLevel {
    case beginner
    case good
    case great
    case excellent
    case legendary

    var description: String {
        switch self {
        case .beginner: return "Getting started"
        case .good: return "Building momentum"
        case .great: return "Strong compliance"
        case .excellent: return "Outstanding"
        case .legendary: return "Legendary streak"
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        ComplianceStreakCount(streakDays: 5, style: .badge)
        ComplianceStreakCount(streakDays: 45, style: .card)
        ComplianceStreakCount(streakDays: 200, style: .compact)
        ComplianceStreakCount(streakDays: 400, style: .card)
    }
    .padding()
}

