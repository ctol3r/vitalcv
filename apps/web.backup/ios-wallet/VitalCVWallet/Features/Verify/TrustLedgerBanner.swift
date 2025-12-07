//
//  TrustLedgerBanner.swift
//  VitalCVWallet
//
//  Created: Phase 5 - Task 40
//  Add final Verified on VitalCV Trust Ledger banner
//

import SwiftUI

struct TrustLedgerBanner: View {
    let trustScore: TrustScore
    @State private var isVisible = false

    var body: some View {
        VStack(spacing: WalletSpacing.sm) {
            HStack(spacing: WalletSpacing.sm) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.white)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text("Verified on VitalCV Trust Ledger")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)

                    Text("Trust Score: \(Int(trustScore.value * 100))%")
                        .font(WalletTypography.caption)
                        .foregroundColor(.white.opacity(0.9))
                }

                Spacer()

                // Trust level indicator
                Circle()
                    .fill(trustColor)
                    .frame(width: 12, height: 12)
            }
            .padding()
            .background(
                LinearGradient(
                    colors: [
                        Color.blue.opacity(0.9),
                        Color.purple.opacity(0.9)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(WalletCornerRadius.medium)
            .walletShadow(WalletShadow.medium)
        }
        .opacity(isVisible ? 1 : 0)
        .offset(y: isVisible ? 0 : 20)
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isVisible = true
            }
        }
    }

    private var trustColor: Color {
        if trustScore.value >= 0.8 {
            return .green
        } else if trustScore.value >= 0.5 {
            return .yellow
        } else {
            return .red
        }
    }
}

