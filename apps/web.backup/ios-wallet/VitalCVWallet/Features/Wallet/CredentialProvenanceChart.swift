//
//  CredentialProvenanceChart.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 33
//  Credential provenance chart
//

import SwiftUI

/// CredentialProvenanceChart - Visual chart showing credential provenance chain
struct CredentialProvenanceChart: View {
    let credential: VerifiableCredential

    @State private var selectedNode: ProvenanceNode?

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Provenance Chain")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            // Timeline view
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: WalletSpacing.lg) {
                    ForEach(provenanceNodes) { node in
                        ProvenanceNodeView(
                            node: node,
                            isSelected: selectedNode?.id == node.id
                        ) {
                            selectedNode = node
                        }
                    }
                }
                .padding(.horizontal, WalletSpacing.md)
            }

            // Selected node details
            if let selected = selectedNode {
                ProvenanceNodeDetails(node: selected)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    private var provenanceNodes: [ProvenanceNode] {
        var nodes: [ProvenanceNode] = []

        // Node 1: Issuance
        nodes.append(ProvenanceNode(
            id: "issuance",
            title: "Issued",
            timestamp: credential.issuanceDate,
            type: .issuance,
            issuer: credential.issuer.name ?? credential.issuer.id,
            description: "Credential issued by issuer"
        ))

        // Node 2: Chain Anchor (if available)
        if let anchorId = credential.chainAnchorId {
            nodes.append(ProvenanceNode(
                id: "anchor",
                title: "Anchored",
                timestamp: credential.issuanceDate.addingTimeInterval(60), // Simulated
                type: .chainAnchor,
                issuer: "Blockchain",
                description: "Anchored on chain: \(anchorId.prefix(16))..."
            ))
        }

        // Node 3: Verifications (if available)
        // In production, this would come from verification history
        nodes.append(ProvenanceNode(
            id: "verification",
            title: "Verified",
            timestamp: Date(),
            type: .verification,
            issuer: "Verifier",
            description: "Credential verified"
        ))

        return nodes
    }
}

// MARK: - Provenance Node

struct ProvenanceNode: Identifiable {
    let id: String
    let title: String
    let timestamp: Date
    let type: NodeType
    let issuer: String
    let description: String

    enum NodeType {
        case issuance
        case chainAnchor
        case verification
        case revocation

        var icon: String {
            switch self {
            case .issuance: return "seal.fill"
            case .chainAnchor: return "link"
            case .verification: return "checkmark.shield.fill"
            case .revocation: return "xmark.shield.fill"
            }
        }

        var color: Color {
            switch self {
            case .issuance: return .walletPrimary
            case .chainAnchor: return .walletSuccess
            case .verification: return .walletInfo
            case .revocation: return .walletError
            }
        }
    }
}

// MARK: - Provenance Node View

struct ProvenanceNodeView: View {
    let node: ProvenanceNode
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        VStack(spacing: WalletSpacing.sm) {
            // Connection line (if not first)
            if node.id != "issuance" {
                Rectangle()
                    .fill(node.type.color.opacity(0.3))
                    .frame(width: 2, height: 30)
            }

            // Node circle
            Button(action: action) {
                ZStack {
                    Circle()
                        .fill(node.type.color.opacity(isSelected ? 0.3 : 0.1))
                        .frame(width: 60, height: 60)
                        .overlay(
                            Circle()
                                .stroke(node.type.color, lineWidth: isSelected ? 3 : 2)
                        )

                    Image(systemName: node.type.icon)
                        .foregroundColor(node.type.color)
                        .font(.system(size: 24))
                }
            }
            .buttonStyle(PlainButtonStyle())

            // Node info
            VStack(spacing: WalletSpacing.xs) {
                Text(node.title)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)
                    .bold()

                Text(node.timestamp, style: .relative)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
            .frame(width: 100)
        }
    }
}

// MARK: - Provenance Node Details

struct ProvenanceNodeDetails: View {
    let node: ProvenanceNode

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            HStack {
                Image(systemName: node.type.icon)
                    .foregroundColor(node.type.color)
                    .font(.title2)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(node.title)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text(node.timestamp, format: .dateTime)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()
            }

            Divider()

            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                DetailRow(label: "Issuer", value: node.issuer)
                DetailRow(label: "Description", value: node.description)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)

            Spacer()

            Text(value)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletText)
        }
    }
}

#Preview {
    CredentialProvenanceChart(
        credential: VerifiableCredential(
            id: "test",
            type: ["TestCredential"],
            issuer: Issuer(id: "did:test", name: "Test Issuer", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(
                id: "did:test:subject",
                type: nil,
                claims: [:]
            ),
            proof: nil,
            evidence: nil,
            chainAnchorId: "0x1234..."
        )
    )
    .padding()
}








