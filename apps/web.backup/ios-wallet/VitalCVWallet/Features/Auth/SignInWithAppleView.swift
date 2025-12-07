//
//  SignInWithAppleView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 6
//  Sign In with Apple (SIWA)
//

import SwiftUI
import AuthenticationServices

struct SignInWithAppleView: View {
    @EnvironmentObject var appState: AppStateContainer
    @State private var showingDIDGeneration = false

    var body: some View {
        VStack(spacing: WalletSpacing.xl) {
            Spacer()

            VStack(spacing: WalletSpacing.md) {
                Image(systemName: "person.badge.shield.checkmark.fill")
                    .font(.system(size: 64))
                    .foregroundColor(.walletPrimary)

                Text("Sign in to VitalCV Wallet")
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(.walletText)
                    .multilineTextAlignment(.center)

                Text("Use Sign in with Apple to securely access your credentials")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)
            }

            Spacer()

            SignInWithAppleButton(
                onRequest: { request in
                    request.requestedScopes = [.fullName, .email]
                },
                onCompletion: { result in
                    handleSignInResult(result)
                }
            )
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .cornerRadius(WalletCornerRadius.medium)
            .padding(.horizontal, WalletSpacing.lg)
            .padding(.bottom, WalletSpacing.xl)
        }
        .sheet(isPresented: $showingDIDGeneration) {
            DIDGenerationView()
        }
    }

    private func handleSignInResult(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
                // Generate or retrieve DID for this user
                let userIdentifier = appleIDCredential.user
                generateOrRetrieveDID(for: userIdentifier)
            }
        case .failure(let error):
            print("Sign in with Apple failed: \(error.localizedDescription)")
        }
    }

    private func generateOrRetrieveDID(for userIdentifier: String) {
        // Check if DID already exists for this user
        if let existingDID = KeychainService.shared.loadDID() {
            appState.authenticate(did: existingDID)
        } else {
            // Navigate to DID generation
            showingDIDGeneration = true
        }
    }
}

#Preview {
    SignInWithAppleView()
        .environmentObject(AppStateContainer.shared)
}

