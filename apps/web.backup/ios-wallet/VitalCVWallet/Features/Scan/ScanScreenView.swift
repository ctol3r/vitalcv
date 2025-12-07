//
//  ScanScreenView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 37
//  Scan to Add Credential home button
//

import SwiftUI
import AVFoundation

struct ScanScreenView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var appState: AppStateContainer
    @State private var scannedCode: String?
    @State private var showingError = false
    @State private var errorMessage = ""

    var body: some View {
        ZStack {
            // Camera preview would go here
            // For now, showing a placeholder
            Color.black
                .ignoresSafeArea()

            VStack {
                // Top bar
                HStack {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                    .padding()

                    Spacer()

                    Text("Scan QR Code")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)

                    Spacer()

                    // Spacer for balance
                    Color.clear
                        .frame(width: 60)
                }
                .background(Color.black.opacity(0.5))

                Spacer()

                // Scan area indicator
                RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                    .stroke(Color.walletPrimary, lineWidth: 3)
                    .frame(width: 250, height: 250)
                    .overlay(
                        VStack {
                            Image(systemName: "qrcode.viewfinder")
                                .font(.system(size: 48))
                                .foregroundColor(.walletPrimary)

                            Text("Position QR code within frame")
                                .font(WalletTypography.subheadline)
                                .foregroundColor(.white)
                                .padding(.top, WalletSpacing.md)
                        }
                    )

                Spacer()

                // Instructions
                VStack(spacing: WalletSpacing.sm) {
                    Text("Scan a credential offer QR code")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)

                    Text("Or scan a verification request")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding(.bottom, WalletSpacing.xl)
                .background(Color.black.opacity(0.5))
            }
        }
        .alert("Scan Error", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            requestCameraPermission()
        }
    }

    private func requestCameraPermission() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            if !granted {
                DispatchQueue.main.async {
                    errorMessage = "Camera access is required to scan QR codes"
                    showingError = true
                }
            }
        }
    }

    private func handleScannedCode(_ code: String) {
        // Handle OIDC4VCI credential offer or verification request
        scannedCode = code

        // Parse and handle the QR code content
        // This would integrate with OIDC4VCI flow (Task 21)

        dismiss()
    }
}

#Preview {
    ScanScreenView()
        .environmentObject(AppStateContainer.shared)
}

