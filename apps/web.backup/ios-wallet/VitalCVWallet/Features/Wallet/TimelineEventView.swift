//
//  TimelineEventView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 17
//  Timeline event visualization
//

import SwiftUI

struct TimelineEventView: View {
    let event: TimelineEvent

    var body: some View {
        HStack(alignment: .top, spacing: WalletSpacing.md) {
            // Icon
            Image(systemName: event.type.icon)
                .font(.system(size: 20))
                .foregroundColor(event.type.color)
                .frame(width: 32, height: 32)
                .background(event.type.color.opacity(0.1))
                .cornerRadius(16)

            // Content
            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(event.title)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Text(event.description)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)

                Text(formatDate(event.date))
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()
        }
        .padding(.vertical, WalletSpacing.xs)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}








