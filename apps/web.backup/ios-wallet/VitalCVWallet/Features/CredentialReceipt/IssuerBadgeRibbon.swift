//
//  IssuerBadgeRibbon.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 27
//  Issuer badge ribbon
//

import SwiftUI

/// IssuerBadgeRibbon - Ribbon-style badge for issuer display
struct IssuerBadgeRibbon: View {
    let issuer: Issuer
    let verificationStatus: VerificationStatus

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            // Issuer icon/avatar
            if let imageUrl = issuer.image {
                AsyncImage(url: URL(string: imageUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } placeholder: {
                    Image(systemName: "person.circle.fill")
                        .foregroundColor(.walletPrimary)
                }
                .frame(width: 32, height: 32)
                .cornerRadius(16)
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.walletPrimary)
            }

            // Issuer name
            Text(issuer.name ?? "Unknown Issuer")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            Spacer()

            // Verification badge
            verificationBadge
        }
        .padding()
        .background(
            LinearGradient(
                colors: [
                    Color.walletPrimary.opacity(0.1),
                    Color.walletPrimary.opacity(0.05)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .cornerRadius(WalletCornerRadius.medium)
        .overlay(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .stroke(borderColor, lineWidth: 1)
        )
    }

    private var verificationBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: verificationStatus.icon)
                .font(.system(size: 12))

            Text(verificationStatus.text)
                .font(WalletTypography.caption)
        }
        .foregroundColor(verificationStatus.color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(verificationStatus.color.opacity(0.1))
        .cornerRadius(WalletCornerRadius.small)
    }

    private var borderColor: Color {
        switch verificationStatus {
        case .verified:
            return .walletSuccess
        case .pending:
            return .walletWarning
        case .unverified:
            return .walletError
        }
    }
}

// MARK: - Verification Status

enum VerificationStatus {
    case verified
    case pending
    case unverified

    var icon: String {
        switch self {
        case .verified: return "checkmark.shield.fill"
        case .pending: return "clock.fill"
        case .unverified: return "exclamationmark.shield.fill"
        }
    }

    var text: String {
        switch self {
        case .verified: return "Verified"
        case .pending: return "Pending"
        case .unverified: return "Unverified"
        }
    }

    var color: Color {
        switch self {
        case .verified: return .walletSuccess
        case .pending: return .walletWarning
        case .unverified: return .walletError
        }
    }
}

#Preview {
    VStack(spacing: WalletSpacing.md) {
        IssuerBadgeRibbon(
            issuer: Issuer(id: "did:example:issuer", name: "Verified Medical Board", image: nil),
            verificationStatus: .verified
        )

        IssuerBadgeRibbon(
            issuer: Issuer(id: "did:example:issuer2", name: "Pending Verification", image: nil),
            verificationStatus: .pending
        )

        IssuerBadgeRibbon(
            issuer: Issuer(id: "did:example:issuer3", name: "Unverified Issuer", image: nil),
            verificationStatus: .unverified
        )
    }
    .padding()
    .background(Color.walletBackground)
}

