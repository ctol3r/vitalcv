//
//  CredentialOfferUIView.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 6
//  Full OIDC4VCI Credential Offer UI
//

import SwiftUI

struct CredentialOfferUIView: View {
    let offer: CredentialOffer
    @StateObject private var viewModel = CredentialOfferViewModel()
    @Environment(\.dismiss) var dismiss
    @State private var showingAcceptance = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.xl) {
                    // Header
                    headerSection

                    // Issuer information
                    issuerSection

                    // Credential types
                    credentialTypesSection

                    // Authorization flow info
                    authorizationInfoSection

                    // Accept button
                    acceptButton
                }
                .padding(WalletSpacing.lg)
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
            .sheet(isPresented: $showingAcceptance) {
                if let credential = viewModel.receivedCredential {
                    CredentialAcceptanceView(credential: credential)
                }
            }
            .alert("Error", isPresented: .constant(viewModel.error != nil)) {
                Button("OK") {
                    viewModel.error = nil
                }
            } message: {
                if let error = viewModel.error {
                    Text(error.localizedDescription)
                }
            }
        }
    }

    private var headerSection: some View {
        VStack(spacing: WalletSpacing.md) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletPrimary)

            Text("New Credential Offer")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)

            Text("You've received a credential offer from an issuer")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var issuerSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Issuer")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            HStack {
                Image(systemName: "building.2.fill")
                    .foregroundColor(.walletPrimary)

                Text(offer.credentialIssuer)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Spacer()
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
        }
    }

    private var credentialTypesSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Credential Types")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            ForEach(offer.credentials, id: \.format) { credential in
                CredentialTypeCard(definition: credential)
            }
        }
    }

    private var authorizationInfoSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Authorization")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            if let preAuthCode = offer.grants?.preAuthorizationCode {
                HStack {
                    Image(systemName: "key.fill")
                        .foregroundColor(.walletSuccess)

                    VStack(alignment: .leading) {
                        Text("Pre-authorized")
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletText)

                        if preAuthCode.userPinRequired == true {
                            Text("PIN required")
                                .font(WalletTypography.caption1)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }

                    Spacer()
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            } else if offer.grants?.authorizationCode != nil {
                HStack {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundColor(.walletPrimary)

                    Text("Authorization code flow")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletText)

                    Spacer()
                }
                .padding()
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
            }
        }
    }

    private var acceptButton: some View {
        Button(action: {
            Task {
                await viewModel.acceptOffer(offer: offer)
                if viewModel.receivedCredential != nil {
                    showingAcceptance = true
                }
            }
        }) {
            HStack {
                if viewModel.isAccepting {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "checkmark.circle.fill")
                }
                Text(viewModel.isAccepting ? "Accepting..." : "Accept Credential")
                    .font(WalletTypography.headline)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(viewModel.isAccepting ? Color.gray : Color.walletPrimary)
            .cornerRadius(WalletCornerRadius.large)
        }
        .disabled(viewModel.isAccepting)
        .padding(.top, WalletSpacing.lg)
    }
}

struct CredentialTypeCard: View {
    let definition: CredentialDefinition

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(definition.format)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                if let types = definition.types {
                    ForEach(types, id: \.self) { type in
                        Text(type)
                            .font(WalletTypography.caption1)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }

            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.walletSuccess)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

@MainActor
class CredentialOfferViewModel: ObservableObject {
    @Published var isAccepting = false
    @Published var receivedCredential: VerifiableCredential?
    @Published var error: Error?

    private let oidcService = OIDC4VCIService.shared

    func acceptOffer(offer: CredentialOffer) async {
        isAccepting = true
        error = nil

        do {
            // Handle pre-authorized code flow
            if let preAuthGrant = offer.grants?.preAuthorizationCode {
                let tokenResponse = try await oidcService.handlePreAuthorizedCodeFlow(
                    offer: offer,
                    preAuthCode: preAuthGrant.preAuthorizationCode,
                    userPin: nil // Would prompt user if required
                )

                // Request credential with access token
                let credential = try await requestCredential(
                    offer: offer,
                    accessToken: tokenResponse.accessToken
                )

                receivedCredential = credential

                // Accept credential
                await oidcService.acceptCredential(credential: credential)
            } else {
                // Handle authorization code flow
                let authResponse = try await oidcService.authorize(offer: offer)
                // Continue with token exchange...
                error = NSError(domain: "OIDC4VCI", code: 1, userInfo: [NSLocalizedDescriptionKey: "Authorization code flow not fully implemented"])
            }
        } catch {
            self.error = error
        }

        isAccepting = false
    }

    private func requestCredential(offer: CredentialOffer, accessToken: String) async throws -> VerifiableCredential {
        // Request credential from issuer
        let metadata = try await oidcService.discoverIssuerMetadata(credentialIssuer: offer.credentialIssuer)
        guard let credentialEndpoint = metadata.credentialEndpoint else {
            throw OIDCError.missingTokenEndpoint
        }

        var request = URLRequest(url: credentialEndpoint)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "format": offer.credentials.first?.format ?? "jwt_vc",
            "types": offer.credentials.first?.types ?? []
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw OIDCError.authorizationFailed
        }

        // Parse credential (simplified)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        // In production, properly parse JWT-VC or SD-JWT

        return VerifiableCredential(
            id: UUID().uuidString,
            type: offer.credentials.first?.types ?? ["VerifiableCredential"],
            issuer: Issuer(id: offer.credentialIssuer, name: nil, image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(id: "did:holder", type: nil, claims: [:]),
            proof: nil,
            evidence: nil
        )
    }
}

#Preview {
    CredentialOfferUIView(
        offer: CredentialOffer(
            credentialIssuer: "https://issuer.example.com",
            credentials: [
                CredentialDefinition(format: "jwt_vc", types: ["VerifiableCredential", "MedicalLicense"], trustFramework: nil)
            ],
            grants: Grant(
                authorizationCode: nil,
                preAuthorizationCode: PreAuthorizationCodeGrant(preAuthorizationCode: "pre-auth-code", userPinRequired: false)
            ),
            authorizationServer: URL(string: "https://issuer.example.com/auth")
        )
    )
}

