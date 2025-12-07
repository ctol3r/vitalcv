//
//  HumanReadableCredentialView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 19
//  Human-readable credential parser
//

import SwiftUI

struct HumanReadableCredentialView: View {
    let credential: VerifiableCredential

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Credential Details")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            // Issuer information
            HumanReadableSection(
                title: "Issued by",
                value: credential.issuer.name ?? credential.issuer.id,
                icon: "building.2.fill"
            )

            // Type
            HumanReadableSection(
                title: "Credential Type",
                value: credential.type.joined(separator: ", "),
                icon: "doc.text.fill"
            )

            // Issue date
            HumanReadableSection(
                title: "Issued on",
                value: formatDate(credential.issuanceDate),
                icon: "calendar"
            )

            // Expiration
            if let expirationDate = credential.expirationDate {
                HumanReadableSection(
                    title: "Expires on",
                    value: formatDate(expirationDate),
                    icon: "clock.fill",
                    isWarning: credential.isExpiringSoon
                )
            }

            // Claims
            if !credential.credentialSubject.claims.isEmpty {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Text("Information")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)

                    ForEach(Array(credential.credentialSubject.claims.keys.sorted()), id: \.self) { key in
                        HStack {
                            Text(formatClaimLabel(key))
                                .font(WalletTypography.subheadline)
                                .foregroundColor(.walletTextSecondary)

                            Spacer()

                            Text(credential.credentialSubject.claims[key] ?? "")
                                .font(WalletTypography.subheadline)
                                .foregroundColor(.walletText)
                        }
                        .padding(.vertical, WalletSpacing.xs)
                    }
                }
                .padding(WalletSpacing.md)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func formatClaimLabel(_ key: String) -> String {
        // Convert camelCase/snake_case to readable format
        return key
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression)
            .capitalized
    }
}

struct HumanReadableSection: View {
    let title: String
    let value: String
    let icon: String
    var isWarning: Bool = false

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(isWarning ? .walletWarning : .walletPrimary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(title)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)

                Text(value)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(isWarning ? .walletWarning : .walletText)
            }

            Spacer()
        }
        .padding(WalletSpacing.sm)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.small)
    }
}

#Preview {
    HumanReadableCredentialView(
        credential: VerifiableCredential(
            id: "1",
            type: ["VerifiableCredential", "ProfessionalCredential"],
            issuer: Issuer(id: "did:example:issuer", name: "Medical Board", image: nil),
            issuanceDate: Date(),
            expirationDate: Date().addingTimeInterval(86400 * 30),
            credentialSubject: CredentialSubject(
                id: "did:example:holder",
                type: "Person",
                claims: [
                    "name": "Dr. Jane Smith",
                    "licenseNumber": "MD12345",
                    "specialty": "Cardiology"
                ]
            ),
            proof: nil,
            evidence: nil
        )
    )
    .padding()
}

