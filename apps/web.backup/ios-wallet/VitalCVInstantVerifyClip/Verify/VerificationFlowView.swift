//
//  VerificationFlowView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 3
//  Main verification flow view for App Clip
//

import SwiftUI

struct VerificationFlowView: View {
    let payload: QRPayload
    @EnvironmentObject var clipState: AppClipState
    @StateObject private var engine = ClipVerificationEngine.shared
    @State private var verificationResult: VerificationResult?
    @State private var error: Error?
    @State private var isVerifying = false

    var body: some View {
        ZStack {
            Color.walletBackground.ignoresSafeArea()

            if isVerifying {
                VerificationProgressView()
            } else if let result = verificationResult {
                VerificationResultClipView(result: result)
            } else if let error = error {
                ErrorView(error: error)
            }
        }
        .task {
            await startVerification()
        }
    }

    private func startVerification() async {
        isVerifying = true
        do {
            let result = try await engine.verify(payload: payload)
            verificationResult = result
            clipState.verificationResult = result
        } catch {
            self.error = error
        }
        isVerifying = false
    }
}

// MARK: - Verification Progress View

struct VerificationProgressView: View {
    @State private var progress: Double = 0
    @State private var currentStep: String = "Verifying signature..."

    let steps = [
        "Verifying signature...",
        "Checking issuer trust...",
        "Validating chain anchor...",
        "Verifying compliance...",
        "Calculating trust score..."
    ]

    var body: some View {
        VStack(spacing: 24) {
            // Task 28: Trust pulse animation
            TrustPulseView()

            ProgressView(value: progress, total: 1.0)
                .progressViewStyle(LinearProgressViewStyle(tint: .walletPrimary))
                .frame(width: 200)

            Text(currentStep)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
        }
        .onAppear {
            animateProgress()
        }
    }

    private func animateProgress() {
        for (index, step) in steps.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.5) {
                withAnimation {
                    currentStep = step
                    progress = Double(index + 1) / Double(steps.count)
                }
            }
        }
    }
}

// MARK: - Error View

struct ErrorView: View {
    let error: Error
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 60))
                .foregroundColor(.orange)

            Text("Verification Failed")
                .font(WalletTypography.title)

            Text(error.localizedDescription)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
                .padding()

            Button("Try Again") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}




