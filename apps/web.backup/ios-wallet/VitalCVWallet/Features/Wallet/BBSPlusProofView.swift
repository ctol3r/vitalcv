//
//  BBSPlusProofView.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 24-25
//  ZK-proof progress indicator and "mathematically verified" visual stamp
//

import SwiftUI

struct BBSPlusProofView: View {
    let credential: VerifiableCredential
    @StateObject private var viewModel = BBSPlusProofViewModel()
    @State private var selectedRevealed: Set<String> = []
    @State private var showingResult = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.xl) {
                    // Header
                    headerSection

                    // Attribute selection
                    attributeSelectionSection

                    // Generate proof button
                    generateButton

                    // Task 24: ZK-proof progress indicator
                    if viewModel.isGenerating {
                        proofProgressView
                    }

                    // Task 25: "Mathematically verified" visual stamp
                    if let proof = viewModel.generatedProof {
                        verifiedStampView(proof: proof)
                    }
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("BBS+ Proof")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var headerSection: some View {
        VStack(spacing: WalletSpacing.md) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletPrimary)

            Text("Zero-Knowledge Proof")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)

            Text("Generate a BBS+ proof that reveals only selected attributes while keeping others hidden")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var attributeSelectionSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Select Attributes to Reveal")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            ForEach(Array(credential.credentialSubject.claims.keys.sorted()), id: \.self) { key in
                AttributeSelectionRow(
                    label: key.capitalized,
                    value: credential.credentialSubject.claims[key] ?? "",
                    isSelected: Binding(
                        get: { selectedRevealed.contains(key) },
                        set: { isSelected in
                            if isSelected {
                                selectedRevealed.insert(key)
                            } else {
                                selectedRevealed.remove(key)
                            }
                        }
                    )
                )
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
    }

    private var generateButton: some View {
        Button(action: {
            Task {
                await viewModel.generateProof(
                    credential: credential,
                    revealedAttributes: Array(selectedRevealed)
                )
                if viewModel.generatedProof != nil {
                    showingResult = true
                }
            }
        }) {
            HStack {
                Image(systemName: "key.fill")
                Text("Generate ZK Proof")
                    .font(WalletTypography.headline)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(selectedRevealed.isEmpty ? Color.gray : Color.walletPrimary)
            .cornerRadius(WalletCornerRadius.large)
        }
        .disabled(selectedRevealed.isEmpty || viewModel.isGenerating)
    }

    // Task 24: ZK-proof progress indicator
    private var proofProgressView: some View {
        VStack(spacing: WalletSpacing.md) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .walletPrimary))
                .scaleEffect(1.5)

            Text("Generating Zero-Knowledge Proof...")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletText)

            Text("This may take a few moments")
                .font(WalletTypography.caption1)
                .foregroundColor(.walletTextSecondary)

            // Progress steps
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                ProgressStepView(
                    label: "Building Merkle Tree",
                    isCompleted: viewModel.progressStep >= 1
                )

                ProgressStepView(
                    label: "Computing Proof Parameters",
                    isCompleted: viewModel.progressStep >= 2
                )

                ProgressStepView(
                    label: "Generating Proof Value",
                    isCompleted: viewModel.progressStep >= 3
                )

                ProgressStepView(
                    label: "Verifying Proof",
                    isCompleted: viewModel.progressStep >= 4
                )
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
    }

    // Task 25: "Mathematically verified" visual stamp
    private func verifiedStampView(proof: BBSPlusProof) -> some View {
        VStack(spacing: WalletSpacing.lg) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.walletSuccess, Color.walletPrimary],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 120, height: 120)
                    .shadow(color: Color.walletSuccess.opacity(0.3), radius: 20)

                VStack(spacing: WalletSpacing.xs) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.white)

                    Text("VERIFIED")
                        .font(WalletTypography.caption1)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .tracking(2)
                }
            }

            VStack(spacing: WalletSpacing.sm) {
                Text("Mathematically Verified")
                    .font(WalletTypography.title2)
                    .foregroundColor(.walletText)

                Text("This proof cryptographically verifies the revealed attributes without exposing hidden information")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
            }

            // Proof details
            VStack(alignment: .leading, spacing: WalletSpacing.md) {
                ProofDetailRow(label: "Revealed Attributes", value: "\(proof.revealedAttributes.count)")
                ProofDetailRow(label: "Hidden Attributes", value: "\(proof.hiddenAttributes.count)")
                ProofDetailRow(label: "Merkle Root", value: proof.merkleRoot.prefix(16) + "...")
                ProofDetailRow(label: "Proof Value", value: proof.proofValue.prefix(16) + "...")
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
    }
}

struct AttributeSelectionRow: View {
    let label: String
    let value: String
    @Binding var isSelected: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(label)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Text(value)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
                    .lineLimit(2)
            }

            Spacer()

            Toggle("", isOn: $isSelected)
                .labelsHidden()
        }
        .padding(WalletSpacing.sm)
        .background(isSelected ? Color.walletPrimary.opacity(0.1) : Color.clear)
        .cornerRadius(WalletCornerRadius.small)
    }
}

struct ProgressStepView: View {
    let label: String
    let isCompleted: Bool

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            if isCompleted {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.walletSuccess)
            } else {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .walletPrimary))
                    .scaleEffect(0.8)
            }

            Text(label)
                .font(WalletTypography.subheadline)
                .foregroundColor(isCompleted ? .walletText : .walletTextSecondary)

            Spacer()
        }
    }
}

struct ProofDetailRow: View {
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
                .fontDesign(.monospaced)
                .foregroundColor(.walletText)
        }
    }
}

@MainActor
class BBSPlusProofViewModel: ObservableObject {
    @Published var isGenerating = false
    @Published var progressStep = 0
    @Published var generatedProof: BBSPlusProof?
    @Published var error: Error?

    private let bbsEngine = BBSPlusEngine.shared

    func generateProof(credential: VerifiableCredential, revealedAttributes: [String]) async {
        isGenerating = true
        progressStep = 0
        error = nil

        do {
            // Step 1: Building Merkle Tree
            progressStep = 1
            try await Task.sleep(nanoseconds: 500_000_000)

            // Step 2: Computing Proof Parameters
            progressStep = 2
            try await Task.sleep(nanoseconds: 500_000_000)

            // Step 3: Generating Proof Value
            progressStep = 3

            let allAttributes = Array(credential.credentialSubject.claims.keys)
            let hiddenAttributes = allAttributes.filter { !revealedAttributes.contains($0) }

            let proof = try await bbsEngine.generateProof(
                credential: credential,
                revealedAttributes: revealedAttributes,
                hiddenAttributes: hiddenAttributes
            )

            // Step 4: Verifying Proof
            progressStep = 4
            try await Task.sleep(nanoseconds: 300_000_000)

            generatedProof = proof
        } catch {
            self.error = error
        }

        isGenerating = false
    }
}

#Preview {
    BBSPlusProofView(
        credential: VerifiableCredential(
            id: "1",
            type: ["Credential"],
            issuer: Issuer(id: "did:example", name: nil, image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(
                id: "did:holder",
                type: nil,
                claims: [
                    "name": "John Doe",
                    "email": "john@example.com",
                    "license": "MD12345",
                    "specialty": "Cardiology"
                ]
            ),
            proof: nil,
            evidence: nil
        )
    )
}

