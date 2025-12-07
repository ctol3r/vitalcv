//
//  OfferDigestPreviewView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 26
//  Offer digest preview (fields + trust metadata)
//

import SwiftUI

/// OfferDigestPreviewView - Preview of credential offer with fields and trust metadata
struct OfferDigestPreviewView: View {
    let offer: CredentialOffer
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Header
            Button(action: {
                withAnimation {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: "doc.text.fill")
                        .foregroundColor(.walletPrimary)

                    Text("Credential Offer")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.walletTextSecondary)
                }
                .padding()
                .background(Color.walletCard)
            }

            // Expanded content
            if isExpanded {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    // Issuer info
                    SectionView(title: "Issuer") {
                        HStack {
                            if let image = offer.issuer.image {
                                AsyncImage(url: URL(string: image)) { image in
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                } placeholder: {
                                    ProgressView()
                                }
                                .frame(width: 40, height: 40)
                                .cornerRadius(WalletCornerRadius.small)
                            }

                            VStack(alignment: .leading) {
                                Text(offer.issuer.name ?? "Unknown Issuer")
                                    .font(WalletTypography.headline)
                                Text(offer.issuer.id)
                                    .font(WalletTypography.caption)
                                    .foregroundColor(.walletTextSecondary)
                            }
                        }
                    }

                    // Credential fields
                    SectionView(title: "Credential Fields") {
                        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                            ForEach(offer.fields, id: \.key) { field in
                                FieldRow(label: field.label, value: field.value, isRequired: field.required)
                            }
                        }
                    }

                    // Trust metadata
                    SectionView(title: "Trust Metadata") {
                        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                            TrustMetadataRow(label: "Issuer Verified", value: offer.trustMetadata.issuerVerified)
                            TrustMetadataRow(label: "Chain Anchored", value: offer.trustMetadata.chainAnchored)
                            TrustMetadataRow(label: "Revocation Check", value: offer.trustMetadata.revocationCheck)
                            TrustMetadataRow(label: "Expiration", value: offer.trustMetadata.expirationDate?.formatted(date: .abbreviated, time: .omitted) ?? "No expiration")
                        }
                    }
                }
                .padding()
                .background(Color.walletBackground)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .cornerRadius(WalletCornerRadius.medium)
    }
}

// MARK: - Field Row

struct FieldRow: View {
    let label: String
    let value: String
    let isRequired: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(label)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletText)

                    if isRequired {
                        Text("*")
                            .foregroundColor(.walletError)
                    }
                }

                Text(value)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Trust Metadata Row

struct TrustMetadataRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.body)
                .foregroundColor(.walletText)

            Spacer()

            Text(value)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
        }
    }
}

// MARK: - Section View

struct SectionView<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text(title)
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            content
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.small)
    }
}

// MARK: - Models

struct CredentialOffer {
    let id: String
    let issuer: Issuer
    let type: [String]
    let fields: [CredentialField]
    let trustMetadata: TrustMetadata
}

struct CredentialField {
    let key: String
    let label: String
    let value: String
    let required: Bool
}

struct TrustMetadata {
    let issuerVerified: Bool
    let chainAnchored: Bool
    let revocationCheck: Bool
    let expirationDate: Date?
}

#Preview {
    OfferDigestPreviewView(
        offer: CredentialOffer(
            id: "offer-1",
            issuer: Issuer(id: "did:example:issuer", name: "Test Issuer", image: nil),
            type: ["VerifiableCredential", "MedicalLicense"],
            fields: [
                CredentialField(key: "name", label: "Name", value: "Dr. Jane Doe", required: true),
                CredentialField(key: "license", label: "License Number", value: "MD-12345", required: true),
                CredentialField(key: "state", label: "State", value: "CA", required: true)
            ],
            trustMetadata: TrustMetadata(
                issuerVerified: true,
                chainAnchored: true,
                revocationCheck: true,
                expirationDate: Date().addingTimeInterval(86400 * 365)
            )
        )
    )
    .padding()
    .background(Color.walletBackground)
}

