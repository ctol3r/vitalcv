//
//  CollapsibleCredentialSection.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 17
//  Collapsible sections: Identity, Evidence, Chain, Issuer
//

import SwiftUI

struct CollapsibleCredentialSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content
    @State private var isExpanded: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: {
                withAnimation(StandardAnimations.sheetSpring) {
                    isExpanded.toggle()
                }
                HapticFeedbackService.shared.cardTapped()
            }) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(.walletPrimary)
                        .font(.system(size: 18))

                    Text(title)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.walletTextSecondary)
                        .font(.system(size: 14))
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            }
            .buttonStyle(PlainButtonStyle())

            if isExpanded {
                VStack(alignment: .leading, spacing: WalletSpacing.md) {
                    content
                }
                .padding()
                .background(Color.walletBackground)
                .cornerRadius(WalletCornerRadius.medium)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .walletShadow(WalletShadow.small)
    }
}

// MARK: - Predefined Sections

struct IdentitySection: View {
    let credential: VerifiableCredential

    var body: some View {
        CollapsibleCredentialSection(
            title: "Identity",
            icon: "person.fill"
        ) {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                ForEach(Array(credential.credentialSubject.claims.keys.sorted()), id: \.self) { key in
                    HStack {
                        Text(key.capitalized)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)

                        Spacer()

                        Text(credential.credentialSubject.claims[key] ?? "")
                            .font(WalletTypography.body)
                            .foregroundColor(.walletText)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }
}

struct EvidenceSection: View {
    let evidence: [Evidence]
    @State private var selectedEvidence: Evidence?
    @State private var showingPDF = false

    var body: some View {
        CollapsibleCredentialSection(
            title: "Evidence",
            icon: "doc.text.fill"
        ) {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                ForEach(evidence) { item in
                    EvidenceItemView(evidence: item) {
                        selectedEvidence = item
                        if item.pdfData != nil {
                            showingPDF = true
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showingPDF) {
            if let evidence = selectedEvidence,
               let pdfData = evidence.pdfData {
                PDFPreviewView(pdfData: pdfData, title: evidence.description ?? "Evidence")
            }
        }
    }
}

struct EvidenceItemView: View {
    let evidence: Evidence
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(evidence.type)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    if let description = evidence.description {
                        Text(description)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                    }

                    Text("Source: \(evidence.source)")
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                if evidence.pdfData != nil {
                    Image(systemName: "doc.fill")
                        .foregroundColor(.walletPrimary)
                }
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct ChainSection: View {
    let credential: VerifiableCredential

    var body: some View {
        CollapsibleCredentialSection(
            title: "Blockchain Anchor",
            icon: "link"
        ) {
            ChainAnchorView(credential: credential)
        }
    }
}

struct IssuerSection: View {
    let issuer: Issuer

    var body: some View {
        CollapsibleCredentialSection(
            title: "Issuer",
            icon: "building.2.fill"
        ) {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                if let name = issuer.name {
                    HStack {
                        Text("Name")
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                        Spacer()
                        Text(name)
                            .font(WalletTypography.body)
                            .foregroundColor(.walletText)
                    }
                }

                HStack {
                    Text("DID")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                    Spacer()
                    Text(issuer.id)
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletText)
                }
            }
        }
    }
}








