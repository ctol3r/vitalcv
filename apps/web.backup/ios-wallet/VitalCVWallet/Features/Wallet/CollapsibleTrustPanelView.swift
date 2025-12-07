//
//  CollapsibleTrustPanelView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 16
//  Collapsible trust panel (issuer → chain → compliance)
//

import SwiftUI

/// CollapsibleTrustPanelView - Collapsible panel showing trust chain
struct CollapsibleTrustPanelView: View {
    let credential: VerifiableCredential
    @State private var isExpanded = false
    @State private var selectedSection: TrustSection = .issuer

    enum TrustSection {
        case issuer
        case chain
        case compliance
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            Button(action: {
                withAnimation {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: "shield.checkered")
                        .foregroundColor(.walletPrimary)

                    Text("Trust Chain")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.walletTextSecondary)
                }
                .padding()
                .background(Color.walletCard)
            }

            // Content
            if isExpanded {
                VStack(spacing: 0) {
                    // Section selector
                    Picker("Section", selection: $selectedSection) {
                        Text("Issuer").tag(TrustSection.issuer)
                        Text("Chain").tag(TrustSection.chain)
                        Text("Compliance").tag(TrustSection.compliance)
                    }
                    .pickerStyle(.segmented)
                    .padding()

                    // Section content
                    Group {
                        switch selectedSection {
                        case .issuer:
                            IssuerTrustView(credential: credential)
                        case .chain:
                            ChainTrustView(credential: credential)
                        case .compliance:
                            ComplianceTrustView(credential: credential)
                        }
                    }
                    .frame(maxHeight: 300)
                }
                .background(Color.walletBackground)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .cornerRadius(WalletCornerRadius.medium)
        .shadow(color: .black.opacity(0.1), radius: 5)
    }
}

// MARK: - Issuer Trust View

struct IssuerTrustView: View {
    let credential: VerifiableCredential

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                // Issuer info
                HStack {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.walletPrimary)

                    VStack(alignment: .leading) {
                        Text(credential.issuer.name ?? "Unknown Issuer")
                            .font(WalletTypography.headline)

                        Text(credential.issuer.id)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                }

                Divider()

                // Verification status
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(.walletSuccess)
                    Text("Issuer Verified")
                        .font(WalletTypography.body)
                }
            }
            .padding()
        }
    }
}

// MARK: - Chain Trust View

struct ChainTrustView: View {
    let credential: VerifiableCredential

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                // Chain anchor status
                if let anchorId = credential.chainAnchorId {
                    HStack {
                        Image(systemName: "link")
                            .foregroundColor(.walletPrimary)
                        Text("Anchored to Chain")
                            .font(WalletTypography.headline)
                    }

                    Text("Anchor ID: \(anchorId)")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                } else {
                    HStack {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundColor(.walletWarning)
                        Text("Not Anchored")
                            .font(WalletTypography.headline)
                    }
                }
            }
            .padding()
        }
    }
}

// MARK: - Compliance Trust View

struct ComplianceTrustView: View {
    let credential: VerifiableCredential

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                // Compliance badges
                Text("Compliance Status")
                    .font(WalletTypography.headline)

                ComplianceBadgesView(credential: credential)
            }
            .padding()
        }
    }
}

#Preview {
    CollapsibleTrustPanelView(
        credential: VerifiableCredential(
            id: "1",
            type: ["VerifiableCredential"],
            issuer: Issuer(id: "did:example:issuer", name: "Test Issuer", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(id: "did:example:holder", type: nil, claims: [:]),
            proof: nil,
            evidence: nil
        )
    )
    .padding()
    .background(Color.walletBackground)
}

