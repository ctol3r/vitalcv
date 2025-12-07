//
//  QRShareView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 15
//  Share-proof QR modal
//

import SwiftUI
import CoreImage.CIFilterBuiltins

struct QRShareView: View {
    let credential: VerifiableCredential
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
                        .scaleEffect(1.5)
                }

                Text("Scan this QR code to verify")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Text("This QR contains a verifiable presentation of your credential")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)

                Button(action: {
                    // Share QR code
                    if let qrCode = qrCode {
                        let activityVC = UIActivityViewController(activityItems: [qrCode], applicationActivities: nil)
                        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                           let rootVC = windowScene.windows.first?.rootViewController {
                            rootVC.present(activityVC, animated: true)
                        }
                    }
                }) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Share QR Code")
                            .font(WalletTypography.headline)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.medium)
                }
                .padding(.horizontal, WalletSpacing.lg)
            }
            .padding(WalletSpacing.xl)
            .navigationTitle("Share Credential")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            generateQRCode()
        }
    }

    private func generateQRCode() {
        // Generate QR code from credential data
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        // Create a verifiable presentation JSON
        let presentation: [String: Any] = [
            "type": "VerifiablePresentation",
            "verifiableCredential": [
                "id": credential.id,
                "type": credential.type,
                "issuer": credential.issuer.id,
                "credentialSubject": credential.credentialSubject.id
            ]
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: presentation),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }

        let data = jsonString.data(using: .utf8)!
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
    QRShareView(
        credential: VerifiableCredential(
            id: "1",
            type: ["VerifiableCredential"],
            issuer: Issuer(id: "did:example:issuer", name: "Medical Board", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(id: "did:example:holder", type: "Person", claims: [:]),
            proof: nil,
            evidence: nil
        )
    )
}

