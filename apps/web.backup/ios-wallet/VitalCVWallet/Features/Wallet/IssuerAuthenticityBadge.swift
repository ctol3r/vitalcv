//
//  IssuerAuthenticityBadge.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 20
//  Issuer authenticity badge
//

import SwiftUI

struct IssuerAuthenticityBadge: View {
    let issuer: Issuer
    @State private var authenticityStatus: AuthenticityStatus = .checking

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            Image(systemName: authenticityStatus.icon)
                .font(.system(size: 14))
                .foregroundColor(authenticityStatus.color)

            Text(authenticityStatus.text)
                .font(WalletTypography.caption1)
                .foregroundColor(authenticityStatus.color)
        }
        .padding(.horizontal, WalletSpacing.sm)
        .padding(.vertical, 4)
        .background(authenticityStatus.color.opacity(0.1))
        .cornerRadius(WalletCornerRadius.small)
        .onAppear {
            checkAuthenticity()
        }
    }

    private func checkAuthenticity() {
        // In production, this would check against a trust registry
        // For now, simulate checking
        DispatchQueue.global(qos: .userInitiated).async {
            Thread.sleep(forTimeInterval: 0.5)

            // Mock: Check if issuer is in trust registry
            let isTrusted = issuer.id.contains("example") || issuer.id.contains("vital")

            DispatchQueue.main.async {
                authenticityStatus = isTrusted ? .verified : .unverified
            }
        }
    }
}

enum AuthenticityStatus {
    case checking
    case verified
    case unverified
    case warning

    var icon: String {
        switch self {
        case .checking:
            return "clock.fill"
        case .verified:
            return "checkmark.shield.fill"
        case .unverified:
            return "exclamationmark.shield.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        }
    }

    var text: String {
        switch self {
        case .checking:
            return "Verifying issuer..."
        case .verified:
            return "Verified issuer"
        case .unverified:
            return "Unverified issuer"
        case .warning:
            return "Issuer warning"
        }
    }

    var color: Color {
        switch self {
        case .checking:
            return .walletTextSecondary
        case .verified:
            return .walletSuccess
        case .unverified:
            return .walletError
        case .warning:
            return .walletWarning
        }
    }
}

#Preview {
    VStack(spacing: WalletSpacing.md) {
        IssuerAuthenticityBadge(
            issuer: Issuer(id: "did:example:trusted", name: "Trusted Issuer", image: nil)
        )

        IssuerAuthenticityBadge(
            issuer: Issuer(id: "did:unknown:issuer", name: "Unknown Issuer", image: nil)
        )
    }
    .padding()
}

