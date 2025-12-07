//
//  CollapsibleProofDetailView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 23
//  Verification proof run with collapsible detail
//

import SwiftUI

/// CollapsibleProofDetailView - Collapsible proof verification details
struct CollapsibleProofDetailView: View {
    let verificationResult: VerificationResult
    @State private var isExpanded = false
    @State private var selectedCheck: VerificationCheck?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            Button(action: {
                withAnimation {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(verificationResult.verified ? .walletSuccess : .walletError)

                    Text("Verification Details")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Spacer()

                    // Summary badge
                    HStack(spacing: 4) {
                        Text("\(passedCount)/\(verificationResult.checks.count)")
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)

                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .foregroundColor(.walletTextSecondary)
                            .font(.system(size: 12))
                    }
                }
                .padding()
                .background(Color.walletCard)
            }

            // Expanded content
            if isExpanded {
                VStack(spacing: WalletSpacing.sm) {
                    ForEach(verificationResult.checks, id: \.name) { check in
                        ProofCheckRow(
                            check: check,
                            isSelected: selectedCheck?.name == check.name
                        ) {
                            selectedCheck = selectedCheck?.name == check.name ? nil : check
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

    private var passedCount: Int {
        verificationResult.checks.filter { $0.passed }.count
    }
}

// MARK: - Proof Check Row

struct ProofCheckRow: View {
    let check: VerificationCheck
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onTap) {
                HStack {
                    // Status icon
                    Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor(check.passed ? .walletSuccess : .walletError)
                        .font(.system(size: 20))

                    // Check name
                    Text(check.name)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletText)

                    Spacer()

                    // Expand indicator
                    Image(systemName: isSelected ? "chevron.up" : "chevron.down")
                        .foregroundColor(.walletTextSecondary)
                        .font(.system(size: 12))
                }
                .padding()
                .background(isSelected ? Color.walletPrimary.opacity(0.1) : Color.clear)
            }

            // Expanded details
            if isSelected, let message = check.message {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Divider()

                    Text(message)
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                        .padding(.horizontal)
                        .padding(.bottom)
                }
            }
        }
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.small)
    }
}

#Preview {
    CollapsibleProofDetailView(
        verificationResult: VerificationResult(
            verified: true,
            credentialId: "test",
            checks: [
                VerificationCheck(name: "Signature Valid", passed: true, message: "Ed25519 signature verified"),
                VerificationCheck(name: "Not Expired", passed: true, message: "Credential valid until 2025-12-31"),
                VerificationCheck(name: "Issuer Trusted", passed: true, message: "Issuer verified in trust registry"),
                VerificationCheck(name: "Chain Anchor", passed: false, message: "No chain anchor found")
            ],
            timestamp: Date(),
            verifier: nil,
            error: nil
        )
    )
    .padding()
    .background(Color.walletBackground)
}

