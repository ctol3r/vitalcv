//
//  ErrorBannerView.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 34
//  Error banner for failed sync
//

import SwiftUI

/// ErrorBannerView - Displays sync errors
struct ErrorBannerView: View {
    let error: Error?
    let onRetry: () -> Void
    @State private var isDismissed = false

    var body: some View {
        if let error = error, !isDismissed {
            HStack(spacing: WalletSpacing.md) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.walletError)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text("Sync Failed")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletText)

                    Text(error.localizedDescription)
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                        .lineLimit(2)
                }

                Spacer()

                Button(action: onRetry) {
                    Text("Retry")
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletPrimary)
                        .padding(.horizontal, WalletSpacing.sm)
                        .padding(.vertical, WalletSpacing.xs)
                        .background(Color.walletPrimary.opacity(0.1))
                        .cornerRadius(WalletCornerRadius.small)
                }

                Button(action: { isDismissed = true }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12))
                        .foregroundColor(.walletTextSecondary)
                }
            }
            .padding(WalletSpacing.md)
            .background(Color.walletError.opacity(0.1))
            .cornerRadius(WalletCornerRadius.medium)
            .overlay(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .stroke(Color.walletError.opacity(0.3), lineWidth: 1)
            )
            .padding(.horizontal, WalletSpacing.md)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

