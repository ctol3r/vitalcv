//
//  DIDBackupView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 9
//  DID backup/export flow
//

import SwiftUI

struct DIDBackupView: View {
    let did: String
    @Environment(\.dismiss) var dismiss
    @State private var showingQR = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.xl) {
                    // Warning
                    warningSection

                    // Backup options
                    backupOptionsSection

                    // QR code option
                    qrCodeSection
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Backup Your DID")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingQR) {
                DIDQRView(did: did)
            }
        }
    }

    private var warningSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.walletWarning)
                Text("Important")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)
            }

            Text("If you lose access to this DID, you will lose access to all your credentials. Make sure to back it up securely.")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(WalletSpacing.md)
        .background(Color.walletWarning.opacity(0.1))
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var backupOptionsSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Backup Options")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            // Copy to clipboard
            Button(action: {
                UIPasteboard.general.string = did
            }) {
                HStack {
                    Image(systemName: "doc.on.doc")
                    Text("Copy to Clipboard")
                        .font(WalletTypography.headline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                }
                .foregroundColor(.walletText)
                .padding(WalletSpacing.md)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
                .walletShadow(WalletShadow.small)
            }

            // Share
            Button(action: {
                shareDID()
            }) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                    Text("Share")
                        .font(WalletTypography.headline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                }
                .foregroundColor(.walletText)
                .padding(WalletSpacing.md)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
                .walletShadow(WalletShadow.small)
            }

            // Save to Files
            Button(action: {
                saveToFiles()
            }) {
                HStack {
                    Image(systemName: "folder")
                    Text("Save to Files")
                        .font(WalletTypography.headline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                }
                .foregroundColor(.walletText)
                .padding(WalletSpacing.md)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
                .walletShadow(WalletShadow.small)
            }
        }
    }

    private var qrCodeSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("QR Code Backup")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            Button(action: {
                showingQR = true
            }) {
                HStack {
                    Image(systemName: "qrcode")
                    Text("Show QR Code")
                        .font(WalletTypography.headline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(WalletSpacing.md)
                .background(Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.medium)
            }

            Text("Scan this QR code with another device to transfer your DID")
                .font(WalletTypography.caption1)
                .foregroundColor(.walletTextSecondary)
        }
    }

    private func shareDID() {
        let activityVC = UIActivityViewController(activityItems: [did], applicationActivities: nil)
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }

    private func saveToFiles() {
        // Save DID to Files app
        let text = "VitalCV Wallet DID Backup\n\nDID: \(did)\nBacked up: \(Date())\n\nKeep this file secure."

        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("vitalcv-did-backup.txt")

        try? text.write(to: tempURL, atomically: true, encoding: .utf8)

        let activityVC = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }
}

struct DIDQRView: View {
    let did: String
    @Environment(\.dismiss) var dismiss
    @State private var qrCode: UIImage?

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.xl) {
                if let qrCode = qrCode {
                    Image(uiImage: qrCode)
                        .resizable()
                        .interpolation(.none)
                        .scaledToFit()
                        .frame(width: 250, height: 250)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WalletCornerRadius.large)
                        .walletShadow(WalletShadow.large)
                } else {
                    ProgressView()
                }

                Text("Scan this QR code to import your DID on another device")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)
            }
            .padding(WalletSpacing.xl)
            .navigationTitle("DID QR Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                generateQRCode()
            }
        }
    }

    private func generateQRCode() {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        let data = did.data(using: .utf8)!
        filter.setValue(data, forKey: "inputMessage")

        if let outputImage = filter.outputImage {
            let transform = CGAffineTransform(scaleX: 10, y: 10)
            let scaledImage = outputImage.transformed(by: transform)

            if let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) {
                qrCode = UIImage(cgImage: cgImage)
            }
        }
    }
}

#Preview {
    DIDBackupView(did: "did:vital:1234567890")
}

