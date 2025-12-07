//
//  CryptographicProofInspector.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 20
//  Cryptographic proof inspector (developer mode)
//

import SwiftUI

/// CryptographicProofInspector - Developer mode proof inspector
struct CryptographicProofInspector: View {
    let credential: VerifiableCredential
    @State private var proofDetails: ProofDetails?
    @State private var isExpanded: [String: Bool] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Header
            HStack {
                Image(systemName: "key.fill")
                    .foregroundColor(.walletPrimary)
                Text("Cryptographic Proof Inspector")
                    .font(WalletTypography.headline)
            }

            if let proof = credential.proof {
                // Proof format
                ProofSection(title: "Proof Format") {
                    Text(proof.type)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletText)
                }

                // Verification method
                CollapsibleSection(
                    title: "Verification Method",
                    isExpanded: isExpanded["verificationMethod", default: false]
                ) {
                    isExpanded["verificationMethod"] = !(isExpanded["verificationMethod"] ?? false)
                } content: {
                    VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                        Text(proof.verificationMethod)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                            .textSelection(.enabled)
                    }
                }

                // Proof purpose
                ProofSection(title: "Proof Purpose") {
                    Text(proof.proofPurpose)
                        .font(WalletTypography.body)
                }

                // JWS signature
                if let jws = proof.jws {
                    CollapsibleSection(
                        title: "JWS Signature",
                        isExpanded: isExpanded["jws", default: false]
                    ) {
                        isExpanded["jws"] = !(isExpanded["jws"] ?? false)
                    } content: {
                        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                            Text(jws)
                                .font(WalletTypography.caption)
                                .foregroundColor(.walletTextSecondary)
                                .textSelection(.enabled)
                                .lineLimit(isExpanded["jws"] == true ? nil : 3)
                        }
                    }
                }

                // Created timestamp
                ProofSection(title: "Created") {
                    Text(formatDate(proof.created))
                        .font(WalletTypography.body)
                }

                // Raw proof data (developer mode)
                CollapsibleSection(
                    title: "Raw Proof Data",
                    isExpanded: isExpanded["raw", default: false]
                ) {
                    isExpanded["raw"] = !(isExpanded["raw"] ?? false)
                } content: {
                    if let rawData = encodeProof(proof) {
                        Text(rawData)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.walletTextSecondary)
                            .textSelection(.enabled)
                            .padding()
                            .background(Color.walletCard)
                            .cornerRadius(WalletCornerRadius.small)
                    }
                }
            } else {
                Text("No proof available")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .onAppear {
            loadProofDetails()
        }
    }

    private func loadProofDetails() {
        // Load additional proof details if available
        if let proof = credential.proof {
            proofDetails = ProofDetails(
                format: detectProofFormat(proof),
                algorithm: extractAlgorithm(proof),
                signature: proof.jws
            )
        }
    }

    private func detectProofFormat(_ proof: Proof) -> String {
        if proof.type.contains("JWT") {
            return "JWT-VC"
        } else if proof.type.contains("SD-JWT") {
            return "SD-JWT"
        } else if proof.type.contains("BBS") {
            return "BBS+"
        }
        return proof.type
    }

    private func extractAlgorithm(_ proof: Proof) -> String {
        // Extract algorithm from proof type or JWS
        if proof.type.contains("Ed25519") {
            return "Ed25519"
        } else if proof.type.contains("RSA") {
            return "RSA"
        }
        return "Unknown"
    }

    private func encodeProof(_ proof: Proof) -> String? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        encoder.dateEncodingStrategy = .iso8601

        if let data = try? encoder.encode(proof),
           let string = String(data: data, encoding: .utf8) {
            return string
        }
        return nil
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Proof Section

struct ProofSection<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text(title)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
            content
        }
        .padding()
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.small)
    }
}

// MARK: - Collapsible Section

struct CollapsibleSection<Content: View>: View {
    let title: String
    let isExpanded: Bool
    let toggle: () -> Void
    let content: Content

    init(
        title: String,
        isExpanded: Bool,
        toggle: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.isExpanded = isExpanded
        self.toggle = toggle
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack {
                    Text(title)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.walletTextSecondary)
                }
                .padding()
            }

            if isExpanded {
                content
                    .padding()
                    .background(Color.walletBackground)
            }
        }
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

// MARK: - Models

struct ProofDetails {
    let format: String
    let algorithm: String
    let signature: String?
}

#Preview {
    CryptographicProofInspector(
        credential: VerifiableCredential(
            id: "1",
            type: ["VerifiableCredential"],
            issuer: Issuer(id: "did:example:issuer", name: "Issuer", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(id: "did:example:holder", type: nil, claims: [:]),
            proof: Proof(
                type: "Ed25519Signature2020",
                created: Date(),
                proofPurpose: "assertionMethod",
                verificationMethod: "did:example:issuer#key-1",
                jws: "eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..."
            ),
            evidence: nil
        )
    )
    .padding()
    .background(Color.walletBackground)
}

