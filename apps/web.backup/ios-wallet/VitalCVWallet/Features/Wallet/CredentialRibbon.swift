//
//  CredentialRibbon.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 28
//  "Issued today" / "Expiring soon" ribbons
//

import SwiftUI

struct CredentialRibbon: View {
    let credential: VerifiableCredential

    var ribbonType: RibbonType? {
        if isIssuedToday {
            return .issuedToday
        } else if credential.isExpiringSoon {
            return .expiringSoon
        }
        return nil
    }

    private var isIssuedToday: Bool {
        Calendar.current.isDateInToday(credential.issuanceDate)
    }

    var body: some View {
        if let type = ribbonType {
            HStack(spacing: WalletSpacing.xs) {
                Image(systemName: type.icon)
                    .font(.system(size: 12))
                Text(type.text)
                    .font(WalletTypography.caption2)
            }
            .foregroundColor(.white)
            .padding(.horizontal, WalletSpacing.sm)
            .padding(.vertical, 4)
            .background(type.color)
            .cornerRadius(WalletCornerRadius.small)
        }
    }
}

enum RibbonType {
    case issuedToday
    case expiringSoon

    var text: String {
        switch self {
        case .issuedToday:
            return "Issued today"
        case .expiringSoon:
            return "Expiring soon"
        }
    }

    var icon: String {
        switch self {
        case .issuedToday:
            return "sparkles"
        case .expiringSoon:
            return "exclamationmark.triangle.fill"
        }
    }

    var color: Color {
        switch self {
        case .issuedToday:
            return .walletSuccess
        case .expiringSoon:
            return .walletWarning
        }
    }
}

#Preview {
    VStack(spacing: WalletSpacing.md) {
        CredentialRibbon(
            credential: VerifiableCredential(
                id: "1",
                type: ["Credential"],
                issuer: Issuer(id: "did:example", name: nil, image: nil),
                issuanceDate: Date(),
                expirationDate: nil,
                credentialSubject: CredentialSubject(id: "did:holder", type: nil, claims: [:]),
                proof: nil,
                evidence: nil
            )
        )

        CredentialRibbon(
            credential: VerifiableCredential(
                id: "2",
                type: ["Credential"],
                issuer: Issuer(id: "did:example", name: nil, image: nil),
                issuanceDate: Date().addingTimeInterval(-86400 * 10),
                expirationDate: Date().addingTimeInterval(86400 * 30),
                credentialSubject: CredentialSubject(id: "did:holder", type: nil, claims: [:]),
                proof: nil,
                evidence: nil
            )
        )
    }
    .padding()
}

