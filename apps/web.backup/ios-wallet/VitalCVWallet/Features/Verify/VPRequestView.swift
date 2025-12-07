//
//  VPRequestView.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 12-13
//  Nonce-challenge UI and dynamic VP request renderer
//

import SwiftUI

struct VPRequestView: View {
    let request: VPRequest
    @StateObject private var viewModel = VPRequestViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var selectedCredentials: Set<String> = []

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.xl) {
                    // Header
                    headerSection

                    // Verifier information
                    verifierSection

                    // Challenge info
                    challengeSection

                    // Requested credentials
                    requestedCredentialsSection

                    // Available credentials
                    availableCredentialsSection

                    // Submit button
                    submitButton
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Verification Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: .constant(viewModel.result != nil)) {
                if let result = viewModel.result {
                    VPResultView(result: result)
                }
            }
        }
    }

    private var headerSection: some View {
        VStack(spacing: WalletSpacing.md) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletPrimary)

            Text("Verification Request")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)

            Text("A verifier is requesting proof of your credentials")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var verifierSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Verifier")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            HStack {
                Image(systemName: "building.2.fill")
                    .foregroundColor(.walletPrimary)

                Text(request.clientId)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Spacer()
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
        }
    }

    private var challengeSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Challenge")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            HStack {
                Image(systemName: "key.fill")
                    .foregroundColor(.walletSuccess)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text("Nonce")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletText)

                    Text(request.nonce)
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                        .fontDesign(.monospaced)
                }

                Spacer()
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)

            if let challenge = request.challenge {
                HStack {
                    Image(systemName: "lock.shield.fill")
                        .foregroundColor(.walletPrimary)

                    VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                        Text("Challenge")
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletText)

                        Text(challenge)
                            .font(WalletTypography.caption1)
                            .foregroundColor(.walletTextSecondary)
                            .fontDesign(.monospaced)
                    }

                    Spacer()
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            }
        }
    }

    private var requestedCredentialsSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Requested")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            if let definition = request.presentationDefinition {
                ForEach(definition.inputDescriptors ?? [], id: \.id) { descriptor in
                    InputDescriptorCard(descriptor: descriptor)
                }
            } else {
                Text("No specific requirements")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.walletCard)
                    .cornerRadius(WalletCornerRadius.medium)
            }
        }
    }

    private var availableCredentialsSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Your Credentials")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            // In production, load from wallet
            Text("Select credentials to share")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
        }
    }

    private var submitButton: some View {
        Button(action: {
            Task {
                await viewModel.submitPresentation(request: request, selectedCredentials: Array(selectedCredentials))
            }
        }) {
            HStack {
                if viewModel.isSubmitting {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "paperplane.fill")
                }
                Text(viewModel.isSubmitting ? "Submitting..." : "Submit Presentation")
                    .font(WalletTypography.headline)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(viewModel.isSubmitting || selectedCredentials.isEmpty ? Color.gray : Color.walletPrimary)
            .cornerRadius(WalletCornerRadius.large)
        }
        .disabled(viewModel.isSubmitting || selectedCredentials.isEmpty)
        .padding(.top, WalletSpacing.lg)
    }
}

struct InputDescriptorCard: View {
    let descriptor: InputDescriptor

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            if let name = descriptor.name {
                Text(name)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)
            }

            if let purpose = descriptor.purpose {
                Text(purpose)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

struct VPResultView: View {
    let result: VPSubmissionResult
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.xl) {
                Image(systemName: result.verified == true ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(.system(size: 64))
                    .foregroundColor(result.verified == true ? .walletSuccess : .walletError)

                Text(result.verified == true ? "Verification Successful" : "Verification Failed")
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(.walletText)

                if let error = result.error {
                    Text(error)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletError)
                        .multilineTextAlignment(.center)
                }

                Button("Done") {
                    dismiss()
                }
                .font(WalletTypography.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.large)
            }
            .padding(WalletSpacing.lg)
            .navigationTitle("Result")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

@MainActor
class VPRequestViewModel: ObservableObject {
    @Published var isSubmitting = false
    @Published var result: VPSubmissionResult?
    @Published var error: Error?

    private let vpService = OIDC4VPService.shared

    func submitPresentation(request: VPRequest, selectedCredentials: [String]) async {
        isSubmitting = true
        error = nil

        do {
            // Build presentation from selected credentials
            // In production, load actual credentials from wallet
            let credentials: [VerifiableCredential] = [] // Would load from wallet

            let presentation = try await vpService.buildPresentation(
                credentials: credentials,
                requestedClaims: nil
            )

            // Submit to verifier
            guard let endpoint = request.redirectURI.flatMap({ URL(string: $0) }) else {
                throw OIDC4VPError.missingClientId
            }

            let submissionResult = try await vpService.submitPresentation(
                presentation,
                to: endpoint,
                with: request
            )

            result = submissionResult
        } catch {
            self.error = error
        }

        isSubmitting = false
    }
}

#Preview {
    VPRequestView(
        request: VPRequest(
            clientId: "verifier.example.com",
            redirectURI: "https://verifier.example.com/callback",
            nonce: "abc123",
            state: "state123",
            presentationDefinition: nil,
            challenge: "challenge123"
        )
    )
}

