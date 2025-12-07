//
//  CredentialAIAssistantView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 18
//  "Explain This Credential" AI assistant
//

import SwiftUI

struct CredentialAIAssistantView: View {
    let credential: VerifiableCredential
    @State private var explanation: String?
    @State private var isGenerating = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.walletPrimary)
                    .font(.system(size: 20))

                Text("Explain This Credential")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Spacer()

                if isGenerating {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                }
            }
            .padding()
            .background(Color.walletPrimary.opacity(0.1))
            .cornerRadius(WalletCornerRadius.medium)

            if let explanation = explanation {
                ScrollView {
                    Text(explanation)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletText)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.walletCard)
                        .cornerRadius(WalletCornerRadius.medium)
                }
                .frame(maxHeight: 200)
            }

            if let error = error {
                Text(error)
                    .font(WalletTypography.footnote)
                    .foregroundColor(.walletError)
                    .padding(.horizontal)
            }

            if explanation == nil && !isGenerating {
                Button(action: {
                    Task {
                        await generateExplanation()
                    }
                }) {
                    HStack {
                        Image(systemName: "sparkles")
                        Text("Generate Explanation")
                    }
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.medium)
                }
            }
        }
        .padding()
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }

    private func generateExplanation() async {
        isGenerating = true
        error = nil

        do {
            // In production, call AI service to generate explanation
            // For now, generate a simple explanation
            let explanationText = await generateAICredentialExplanation(for: credential)

            await MainActor.run {
                self.explanation = explanationText
                self.isGenerating = false
            }
        } catch {
            await MainActor.run {
                self.error = "Failed to generate explanation: \(error.localizedDescription)"
                self.isGenerating = false
            }
        }
    }

    private func generateAICredentialExplanation(for credential: VerifiableCredential) async -> String {
        // Simulate AI generation delay
        try? await Task.sleep(nanoseconds: 1_500_000_000) // 1.5 seconds

        let type = credential.type.first ?? "Credential"
        let issuer = credential.issuer.name ?? credential.issuer.id
        let claims = credential.credentialSubject.claims

        return """
        This is a \(type) credential issued by \(issuer).

        **What it means:**
        This credential verifies your \(type.lowercased()) and is stored securely in your wallet. It can be shared with verifiers who need to confirm your qualifications.

        **Key Information:**
        \(claims.map { "• \($0.key): \($0.value)" }.joined(separator: "\n"))

        **How to use it:**
        You can share this credential by scanning a QR code or sending it directly to a verifier. The credential is cryptographically signed, ensuring its authenticity.
        """
    }
}








