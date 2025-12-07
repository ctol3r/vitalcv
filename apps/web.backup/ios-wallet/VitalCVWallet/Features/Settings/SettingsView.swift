//
//  SettingsView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 46-50
//  Profile, DID backup QR, issuer connections, reset, themes
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppStateContainer
    @StateObject private var viewModel = SettingsViewModel()
    @State private var showingDIDQR = false
    @State private var showingResetConfirm = false

    var body: some View {
        NavigationView {
            Form {
                // Task 46: Profile screen
                Section {
                    ProfileHeaderView()
                }

                Section("Identity") {
                    // Task 47: DID backup/export QR
                    Button(action: {
                        showingDIDQR = true
                    }) {
                        HStack {
                            Image(systemName: "qrcode")
                            Text("Backup DID")
                        }
                    }

                    if let did = appState.currentUserDid {
                        Text(did)
                            .font(WalletTypography.caption1)
                            .foregroundColor(.walletTextSecondary)
                    }
                }

                // Smart Resume Generator
                Section("Professional") {
                    NavigationLink(destination: ResumeView()) {
                        HStack {
                            Image(systemName: "doc.text.fill")
                            Text("Smart Resume")
                        }
                    }
                }

                // Task 48: Issuer connections viewer
                Section("Issuer Connections") {
                    NavigationLink(destination: IssuerConnectionsView()) {
                        HStack {
                            Image(systemName: "building.2")
                            Text("Connected Issuers")
                        }
                    }
                }

                // Task 50: Theme options
                Section("Appearance") {
                    Picker("Theme", selection: $viewModel.selectedTheme) {
                        Text("Light").tag(Theme.light)
                        Text("Dark").tag(Theme.dark)
                        Text("System").tag(Theme.system)
                    }
                }

                // Notifications 2.0 - Notification settings
                Section("Notifications") {
                    NavigationLink(destination: NotificationSettingsView()) {
                        HStack {
                            Image(systemName: "bell.badge")
                            Text("Notification Settings")
                        }
                    }
                }

                // Task 49: Data wipe/reset flow
                Section("Danger Zone") {
                    Button(role: .destructive, action: {
                        showingResetConfirm = true
                    }) {
                        HStack {
                            Image(systemName: "trash")
                            Text("Reset All Data")
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingDIDQR) {
                DIDBackupQRView()
            }
            .alert("Reset All Data?", isPresented: $showingResetConfirm) {
                Button("Cancel", role: .cancel) { }
                Button("Reset", role: .destructive) {
                    viewModel.resetAllData()
                }
            } message: {
                Text("This will delete all credentials and reset your wallet. This action cannot be undone.")
            }
        }
    }
}

struct ProfileHeaderView: View {
    @EnvironmentObject var appState: AppStateContainer

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            Image(systemName: "person.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletPrimary)

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text("Profile")
                    .font(WalletTypography.headline)

                if let did = appState.currentUserDid {
                    Text(String(did.prefix(20)) + "...")
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            Spacer()
        }
        .padding(.vertical, WalletSpacing.sm)
    }
}

struct DIDBackupQRView: View {
    @EnvironmentObject var appState: AppStateContainer
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.xl) {
                if let did = appState.currentUserDid,
                   let qrImage = SecureQRService.shared.generateQRCodeImage(from: did) {
                    Image(uiImage: qrImage)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 300, height: 300)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WalletCornerRadius.large)

                    Text("Scan this QR code to backup your DID")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding()
            .navigationTitle("DID Backup")
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
}

struct IssuerConnectionsView: View {
    @EnvironmentObject var appState: AppStateContainer

    var body: some View {
        List {
            // Extract unique issuers from credentials
            ForEach(uniqueIssuers, id: \.id) { issuer in
                HStack {
                    Image(systemName: "building.2.fill")
                        .foregroundColor(.walletPrimary)

                    VStack(alignment: .leading) {
                        Text(issuer.name ?? issuer.id)
                            .font(WalletTypography.subheadline)

                        Text(issuer.id)
                            .font(WalletTypography.caption1)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }
        }
        .navigationTitle("Issuer Connections")
    }

    private var uniqueIssuers: [Issuer] {
        var seen = Set<String>()
        return appState.credentials.compactMap { cred in
            if seen.contains(cred.issuer.id) {
                return nil
            }
            seen.insert(cred.issuer.id)
            return cred.issuer
        }
    }
}

@MainActor
class SettingsViewModel: ObservableObject {
    @Published var selectedTheme: Theme = .system

    enum Theme: String, CaseIterable {
        case light, dark, system
    }

    // Task 49: Data wipe/reset flow
    func resetAllData() {
        AppStateContainer.shared.logout()
        // Clear all keychain data
        KeychainService.shared.deleteDID()
        KeychainService.shared.deleteCredentials()
        KeychainService.shared.deletePINHash()
    }
}

