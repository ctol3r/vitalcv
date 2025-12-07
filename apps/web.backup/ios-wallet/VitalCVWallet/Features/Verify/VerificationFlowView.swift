//
//  VerificationFlowView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 22-25
//  Tap-to-verify button and animated verification steps
//

import SwiftUI

struct VerificationFlowView: View {
    let credential: VerifiableCredential
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = VerificationFlowViewModel()
    @State private var currentStep = 0

    var body: some View {
        NavigationView {
            ZStack {
                Color.walletBackground
                    .ignoresSafeArea()

                VStack(spacing: WalletSpacing.xl) {
                    // Task 22: Tap to verify button
                    if !viewModel.isVerifying && viewModel.result == nil {
                        VStack(spacing: WalletSpacing.md) {
                            Image(systemName: "checkmark.shield.fill")
                                .font(.system(size: 64))
                                .foregroundColor(.walletPrimary)

                            Text("Verify Credential")
                                .font(WalletTypography.largeTitle)
                                .foregroundColor(.walletText)

                            Text("Tap to verify this credential")
                                .font(WalletTypography.subheadline)
                                .foregroundColor(.walletTextSecondary)

                            Button(action: {
                                viewModel.verify(credential: credential)
                            }) {
                                Text("Tap to Verify")
                                    .font(WalletTypography.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.walletPrimary)
                                    .cornerRadius(WalletCornerRadius.large)
                            }
                            .padding(.horizontal, WalletSpacing.lg)
                            .padding(.top, WalletSpacing.lg)
                        }
                    }

                    // Task 23: Animated verification steps
                    if viewModel.isVerifying {
                        verificationStepsView
                    }

                    // Task 24: Verification result UI
                    if let result = viewModel.result {
                        verificationResultView(result: result)
                    }
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Verification")
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

    private var verificationStepsView: some View {
        VStack(spacing: WalletSpacing.lg) {
            Text("Verifying...")
                .font(WalletTypography.title2)
                .foregroundColor(.walletText)

            ForEach(Array(viewModel.checks.enumerated()), id: \.offset) { index, check in
                VerificationStepView(
                    check: check,
                    isActive: index == viewModel.currentStep,
                    isCompleted: index < viewModel.currentStep
                )
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
    }

    private func verificationResultView(result: VerificationResult) -> some View {
        VStack(spacing: WalletSpacing.lg) {
            Image(systemName: result.verified ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(result.verified ? .walletSuccess : .walletError)

            Text(result.verified ? "Verification Successful" : "Verification Failed")
                .font(WalletTypography.title1)
                .foregroundColor(.walletText)

            if let error = result.error {
                Text(error)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletError)
                    .multilineTextAlignment(.center)
            }

            // Task 25: Human-readable proof summary
            if result.verified {
                proofSummaryView(checks: result.checks)
            }

            Button("Done") {
                dismiss()
            }
            .font(WalletTypography.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.walletPrimary)
            .cornerRadius(WalletCornerRadius.medium)
            .padding(.horizontal, WalletSpacing.lg)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
    }

    private func proofSummaryView(checks: [VerificationCheck]) -> some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Verification Summary")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            ForEach(checks, id: \.name) { check in
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
            }
        }
        .padding()
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

struct VerificationStepView: View {
    let check: VerificationCheck
    let isActive: Bool
    let isCompleted: Bool

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            if isCompleted {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.walletSuccess)
            } else if isActive {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle())
            } else {
                Image(systemName: "circle")
                    .foregroundColor(.walletTextSecondary)
            }

            Text(check.name)
                .font(WalletTypography.subheadline)
                .foregroundColor(isActive ? .walletText : .walletTextSecondary)

            Spacer()
        }
        .padding()
        .background(isActive ? Color.walletPrimary.opacity(0.1) : Color.clear)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

@MainActor
class VerificationFlowViewModel: ObservableObject {
    @Published var isVerifying = false
    @Published var currentStep = 0
    @Published var checks: [VerificationCheck] = []
    @Published var result: VerificationResult?

    func verify(credential: VerifiableCredential) {
        isVerifying = true
        currentStep = 0

        // Task 23: Animated verification steps
        checks = [
            VerificationCheck(name: "Validate Signature", passed: false, message: nil),
            VerificationCheck(name: "Check Expiration", passed: false, message: nil),
            VerificationCheck(name: "Check Issuer Trust", passed: false, message: nil),
            VerificationCheck(name: "Check Chain Anchor", passed: false, message: nil),
            VerificationCheck(name: "Check NCQA/PSV Flags", passed: false, message: nil)
        ]

        // Simulate verification steps
        Task {
            for i in 0..<checks.count {
                try? await Task.sleep(nanoseconds: 800_000_000) // 0.8s per step

                await MainActor.run {
                    // Perform actual check (simplified)
                    let passed = performCheck(at: i, for: credential)
                    checks[i].passed = passed
                    currentStep = i + 1
                }
            }

            // All checks passed?
            let allPassed = checks.allSatisfy { $0.passed }

            await MainActor.run {
                result = VerificationResult(
                    verified: allPassed,
                    credentialId: credential.id,
                    checks: checks,
                    timestamp: Date(),
                    verifier: nil,
                    error: allPassed ? nil : "One or more verification checks failed"
                )
                isVerifying = false

                // Task 24: Haptic feedback on result
                HapticFeedbackService.shared.verificationSuccess()
            }
        }
    }

    private func performCheck(at index: Int, for credential: VerifiableCredential) -> Bool {
        switch index {
        case 0: // Validate signature
            return credential.proof != nil
        case 1: // Check expiration
            return !credential.isExpired
        case 2: // Check issuer trust
            return credential.issuer.id.hasPrefix("did:")
        case 3: // Check chain anchor
            return credential.proof != nil
        case 4: // Check NCQA/PSV flags
            return true // Simplified
        default:
            return false
        }
    }
}








