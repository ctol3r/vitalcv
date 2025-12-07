//
//  ImportWalletView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 7
//  "Import previous wallet" flow
//

import SwiftUI

struct ImportWalletView: View {
    @EnvironmentObject var appState: AppStateContainer
    @State private var importMethod: ImportMethod?
    @State private var importText: String = ""
    @State private var isImporting = false
    @State private var importError: String?
    @State private var showingFilePicker = false

    enum ImportMethod: String, CaseIterable {
        case qrCode = "QR Code"
        case jsonFile = "JSON File"
        case mnemonic = "Recovery Phrase"
        case didDocument = "DID Document"

        var icon: String {
            switch self {
            case .qrCode: return "qrcode"
            case .jsonFile: return "doc.text"
            case .mnemonic: return "key.fill"
            case .didDocument: return "person.badge.key"
            }
        }
    }

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.lg) {
                // Header
                VStack(spacing: WalletSpacing.md) {
                    Image(systemName: "square.and.arrow.down")
                        .font(.system(size: 60))
                        .foregroundColor(.walletPrimary)

                    Text("Import Previous Wallet")
                        .font(WalletTypography.title1)
                        .foregroundColor(.walletText)

                    Text("Restore your credentials and identity from a backup")
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, WalletSpacing.lg)
                }
                .padding(.top, WalletSpacing.xl)

                // Import methods
                VStack(spacing: WalletSpacing.md) {
                    ForEach(ImportMethod.allCases, id: \.self) { method in
                        ImportMethodButton(
                            method: method,
                            action: {
                                importMethod = method
                                handleImportMethod(method)
                            }
                        )
                    }
                }
                .padding(.horizontal, WalletSpacing.lg)

                Spacer()

                // Import input (conditional)
                if let method = importMethod {
                    ImportInputView(
                        method: method,
                        text: $importText,
                        isImporting: $isImporting,
                        onImport: {
                            await performImport(method: method, input: importText)
                        }
                    )
                    .padding(.horizontal, WalletSpacing.lg)
                }

                if let error = importError {
                    Text(error)
                        .font(WalletTypography.footnote)
                        .foregroundColor(.walletError)
                        .padding(.horizontal, WalletSpacing.lg)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        // Dismiss
                    }
                }
            }
            .fileImporter(
                isPresented: $showingFilePicker,
                allowedContentTypes: [.json],
                allowsMultipleSelection: false
            ) { result in
                handleFileImport(result)
            }
        }
    }

    private func handleImportMethod(_ method: ImportMethod) {
        switch method {
        case .qrCode:
            // Show QR scanner
            break
        case .jsonFile:
            showingFilePicker = true
        case .mnemonic, .didDocument:
            // Show text input
            break
        }
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            if let url = urls.first {
                Task {
                    await importFromFile(url: url)
                }
            }
        case .failure(let error):
            importError = error.localizedDescription
        }
    }

    private func importFromFile(url: URL) async {
        isImporting = true
        importError = nil

        do {
            let data = try Data(contentsOf: url)
            let walletData = try JSONDecoder().decode(WalletImportData.self, from: data)

            await MainActor.run {
                // Restore DID
                if let did = walletData.did {
                    appState.authenticate(did: did)
                }

                // Restore credentials
                appState.credentials = walletData.credentials

                isImporting = false
            }
        } catch {
            importError = "Failed to import wallet: \(error.localizedDescription)"
            isImporting = false
        }
    }

    private func performImport(method: ImportMethod, input: String) async {
        isImporting = true
        importError = nil

        do {
            switch method {
            case .mnemonic:
                // Recover DID from mnemonic
                let did = try await DIDService.shared.recoverDID(fromMnemonic: input)
                await MainActor.run {
                    appState.authenticate(did: did)
                }

            case .didDocument:
                // Import DID document
                let did = try await DIDService.shared.importDID(fromDocument: input)
                await MainActor.run {
                    appState.authenticate(did: did)
                }

            case .qrCode, .jsonFile:
                break
            }

            isImporting = false
        } catch {
            importError = "Import failed: \(error.localizedDescription)"
            isImporting = false
        }
    }
}

// MARK: - Import Method Button

struct ImportMethodButton: View {
    let method: ImportWalletView.ImportMethod
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: WalletSpacing.md) {
                Image(systemName: method.icon)
                    .font(.title2)
                    .foregroundColor(.walletPrimary)
                    .frame(width: 40)

                Text(method.rawValue)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.walletTextSecondary)
            }
            .padding()
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
            .walletShadow(WalletShadow.small)
        }
    }
}

// MARK: - Import Input View

struct ImportInputView: View {
    let method: ImportWalletView.ImportMethod
    @Binding var text: String
    @Binding var isImporting: Bool
    let onImport: () async -> Void

    var body: some View {
        VStack(spacing: WalletSpacing.md) {
            if method == .mnemonic {
                TextEditor(text: $text)
                    .frame(height: 120)
                    .padding()
                    .background(Color.walletCard)
                    .cornerRadius(WalletCornerRadius.medium)
                    .overlay(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .stroke(Color.walletTextSecondary.opacity(0.2), lineWidth: 1)
                    )
            } else {
                TextField("Enter \(method.rawValue)", text: $text)
                    .textFieldStyle(.roundedBorder)
            }

            Button(action: {
                Task {
                    await onImport()
                }
            }) {
                if isImporting {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Text("Import")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.walletPrimary)
            .cornerRadius(WalletCornerRadius.medium)
            .disabled(isImporting || text.isEmpty)
        }
    }
}

// MARK: - Wallet Import Data

struct WalletImportData: Codable {
    let did: String?
    let credentials: [VerifiableCredential]
    let metadata: [String: String]?
}

#Preview {
    ImportWalletView()
        .environmentObject(AppStateContainer.shared)
}








