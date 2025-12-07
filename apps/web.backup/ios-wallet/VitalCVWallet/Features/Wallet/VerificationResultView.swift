//
//  VerificationResultView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 17
//  Full verification result screen
//

import SwiftUI

struct VerificationResultView: View {
    let result: VerificationResult
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.xl) {
                    // Result icon
                    resultIcon

                    // Result status
                    Text(result.verified ? "Verification Successful" : "Verification Failed")
                        .font(WalletTypography.largeTitle)
                        .foregroundColor(.walletText)
                        .multilineTextAlignment(.center)

                    // Timestamp
                    Text("Verified at \(formatDate(result.timestamp))")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)

                    // Checks
                    checksSection

                    // Verifier info
                    if let verifier = result.verifier {
                        verifierSection(verifier: verifier)
                    }

                    // Error message
                    if let error = result.error {
                        errorSection(error: error)
                    }
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Verification Result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var resultIcon: some View {
        Image(systemName: result.verified ? "checkmark.circle.fill" : "xmark.circle.fill")
            .font(.system(size: 80))
            .foregroundColor(result.verified ? .walletSuccess : .walletError)
            .padding(.top, WalletSpacing.xl)
    }

    private var checksSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Verification Checks")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            ForEach(result.checks, id: \.name) { check in
                HStack {
                    Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor(check.passed ? .walletSuccess : .walletError)

                    VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                        Text(check.name)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletText)

                        if let message = check.message {
                            Text(message)
                                .font(WalletTypography.caption1)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }

                    Spacer()
                }
                .padding(WalletSpacing.md)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
                .walletShadow(WalletShadow.small)
            }
        }
    }

    private func verifierSection(verifier: String) -> some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Verified by")
                .font(WalletTypography.caption1)
                .foregroundColor(.walletTextSecondary)

            Text(verifier)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }

    private func errorSection(error: String) -> some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Error")
                .font(WalletTypography.caption1)
                .foregroundColor(.walletTextSecondary)

            Text(error)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletError)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(WalletSpacing.md)
        .background(Color.walletError.opacity(0.1))
        .cornerRadius(WalletCornerRadius.medium)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    VerificationResultView(
        result: VerificationResult(
            verified: true,
            credentialId: "1",
            checks: [
                VerificationCheck(name: "Signature Valid", passed: true, message: "ECDSA signature verified"),
                VerificationCheck(name: "Issuer Trusted", passed: true, message: "Issuer in trust registry"),
                VerificationCheck(name: "Not Revoked", passed: true, message: "Credential is active")
            ],
            timestamp: Date(),
            verifier: "did:example:verifier",
            error: nil
        )
    )
}

