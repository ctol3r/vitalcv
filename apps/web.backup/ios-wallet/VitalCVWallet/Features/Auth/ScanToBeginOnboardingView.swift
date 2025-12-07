//
//  ScanToBeginOnboardingView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 6
//  "Scan a credential to begin" onboarding path
//

import SwiftUI

struct ScanToBeginOnboardingView: View {
    @EnvironmentObject var appState: AppStateContainer
    @StateObject private var scannerViewModel = QRScannerViewModel()
    @State private var showingScanView = false
    @State private var scannedCredential: VerifiableCredential?

    var body: some View {
        VStack(spacing: WalletSpacing.xl) {
            Spacer()

            // Icon
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 100))
                .foregroundColor(.walletPrimary)
                .padding(.bottom, WalletSpacing.lg)

            // Title
            Text("Scan a Credential to Begin")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, WalletSpacing.lg)

            // Description
            Text("Point your camera at a credential QR code to get started. Your first credential will help set up your digital identity.")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, WalletSpacing.xl)

            Spacer()

            // Scan Button
            Button(action: {
                showingScanView = true
            }) {
                HStack {
                    Image(systemName: "camera.fill")
                    Text("Scan Credential")
                }
                .font(WalletTypography.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.medium)
            }
            .padding(.horizontal, WalletSpacing.lg)

            // Skip option
            Button(action: {
                // Skip to regular onboarding
                appState.isAuthenticated = true
            }) {
                Text("Continue without scanning")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
            }
            .padding(.bottom, WalletSpacing.xl)
        }
        .sheet(isPresented: $showingScanView) {
            ScanScreenView()
                .onCredentialScanned { credential in
                    scannedCredential = credential
                    handleScannedCredential(credential)
                }
        }
        .onChange(of: scannedCredential) { newValue in
            if let credential = newValue {
                handleScannedCredential(credential)
            }
        }
    }

    private func handleScannedCredential(_ credential: VerifiableCredential) {
        // Add credential to wallet
        appState.addCredential(credential)

        // Mark as authenticated
        appState.isAuthenticated = true

        // Navigate to credential detail
        appState.selectedCredential = credential
    }
}

// MARK: - QR Scanner ViewModel

class QRScannerViewModel: ObservableObject {
    @Published var isScanning = false
    @Published var scannedCode: String?
}

// MARK: - Scan Screen Extension

extension ScanScreenView {
    func onCredentialScanned(_ handler: @escaping (VerifiableCredential) -> Void) -> some View {
        self.onScanResult { code in
            // Parse credential from QR code
            if let credential = parseCredential(from: code) {
                handler(credential)
            }
        }
    }

    private func parseCredential(from code: String) -> VerifiableCredential? {
        // Parse credential from QR code string
        // This would typically decode a JWT or JSON-LD credential
        // For now, return nil as placeholder
        return nil
    }
}

#Preview {
    ScanToBeginOnboardingView()
        .environmentObject(AppStateContainer.shared)
}








