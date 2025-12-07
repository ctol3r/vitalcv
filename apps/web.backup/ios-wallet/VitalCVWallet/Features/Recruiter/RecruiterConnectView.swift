//
//  RecruiterConnectView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 40
//  1-step "Connect to Recruiter" card
//

import SwiftUI

struct RecruiterConnectView: View {
    let recruiterId: String?
    @EnvironmentObject var appState: AppStateContainer
    @State private var isConnecting = false
    @State private var connectionResult: ConnectionResult?
    @State private var showingCredentials = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.xl) {
                    // Header
                    headerSection

                    // Connection card
                    connectionCard

                    // Selected credentials
                    if showingCredentials {
                        credentialsSelectionSection
                    }
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Connect to Recruiter")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private var headerSection: some View {
        VStack(spacing: WalletSpacing.sm) {
            Image(systemName: "person.2.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletPrimary)

            Text("Share Your Credentials")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)

            Text("Connect with recruiters and share verified credentials in one tap")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var connectionCard: some View {
        VStack(spacing: WalletSpacing.md) {
            if let result = connectionResult {
                resultView(result: result)
            } else {
                connectButton
            }
        }
        .padding(WalletSpacing.xl)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.large)
    }

    private var connectButton: some View {
        VStack(spacing: WalletSpacing.md) {
            Button(action: {
                showingCredentials = true
            }) {
                HStack {
                    Image(systemName: "link")
                    Text("Connect & Share")
                        .font(WalletTypography.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.medium)
            }

            Text("Share your verified credentials with this recruiter")
                .font(WalletTypography.caption1)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private func resultView(result: ConnectionResult) -> some View {
        VStack(spacing: WalletSpacing.md) {
            Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(result.success ? .walletSuccess : .walletError)

            Text(result.success ? "Connected Successfully" : "Connection Failed")
                .font(WalletTypography.title2)
                .foregroundColor(.walletText)

            if let message = result.message {
                Text(message)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var credentialsSelectionSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Select Credentials to Share")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            ForEach(appState.credentials) { credential in
                CredentialSelectionCard(
                    credential: credential,
                    isSelected: true,
                    onToggle: { }
                )
            }

            Button(action: {
                connectToRecruiter()
            }) {
                Text("Share Selected Credentials")
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.medium)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    private func connectToRecruiter() {
        isConnecting = true

        // Simulate connection
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            connectionResult = ConnectionResult(
                success: true,
                message: "Your credentials have been shared with the recruiter"
            )
            isConnecting = false
            HapticFeedback.play(.success)
        }
    }
}

struct CredentialSelectionCard: View {
    let credential: VerifiableCredential
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        HStack {
            Toggle("", isOn: Binding(
                get: { isSelected },
                set: { _ in onToggle() }
            ))

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(credential.type.first ?? "Credential")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Text(credential.issuer.name ?? credential.issuer.id)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()
        }
        .padding(WalletSpacing.sm)
        .background(isSelected ? Color.walletPrimary.opacity(0.1) : Color.clear)
        .cornerRadius(WalletCornerRadius.small)
    }
}

struct ConnectionResult {
    let success: Bool
    let message: String?
}

#Preview {
    RecruiterConnectView(recruiterId: "recruiter-123")
        .environmentObject(AppStateContainer.shared)
}

