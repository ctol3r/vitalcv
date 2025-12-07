//
//  CredentialOfferIntakeView.swift
//  VitalCVWallet
//
//  Created: Phase 1
//  View for processing credential offers from deep links
//

import SwiftUI

struct CredentialOfferIntakeView: View {
    let url: URL
    @StateObject private var viewModel = CredentialOfferIntakeViewModel()
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator

    var body: some View {
        NavigationView {
            Group {
                switch viewModel.state {
                case .idle:
                    EmptyView()
                case .loading:
                    loadingView
                case .preview(let offer):
                    CredentialOfferUIView(offer: offer.toOIDC4VCICredentialOffer())
                case .error(let error):
                    errorView(error)
                }
            }
            .navigationTitle("Credential Offer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .task {
            await viewModel.processOffer(from: url)
        }
    }

    private var loadingView: some View {
        VStack(spacing: WalletSpacing.lg) {
            ProgressView()
                .scaleEffect(1.5)

            Text("Processing Credential Offer...")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            Text("Validating issuer and fetching metadata")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(WalletSpacing.xl)
    }

    private func errorView(_ error: CredentialOfferError) -> some View {
        VStack(spacing: WalletSpacing.lg) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletError)

            Text("Unable to Process Offer")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)

            Text(error.localizedDescription)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let validation = viewModel.validationResult, !validation.warnings.isEmpty {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Text("Warnings:")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    ForEach(validation.warnings, id: \.self) { warning in
                        HStack(alignment: .top) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.walletWarning)
                            Text(warning)
                                .font(WalletTypography.caption1)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            }

            if let security = viewModel.securityCheck, !security.isSafe {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Text("Security Issues:")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletError)

                    ForEach(security.issues, id: \.self) { issue in
                        HStack(alignment: .top) {
                            Image(systemName: "shield.slash.fill")
                                .foregroundColor(.walletError)
                            Text(issue)
                                .font(WalletTypography.caption1)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            }

            Button("Dismiss") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .padding(.top)
        }
        .padding(WalletSpacing.xl)
    }
}

#Preview {
    CredentialOfferIntakeView(url: URL(string: "vitalcv://offer?credential_offer=https://example.com/offer")!)
        .environmentObject(NavigationCoordinator.shared)
}




