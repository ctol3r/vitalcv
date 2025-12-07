//
//  VerifyOnArrivalView.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 5, Task 36
//  Verify on Arrival flow (scanning clinician QR at nurse station)
//

import SwiftUI

struct VerifyOnArrivalView: View {
    @StateObject private var viewModel = VerifyOnArrivalViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 24) {
            // Header
            VStack(spacing: 8) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 64))
                    .foregroundColor(.blue)

                Text("Verify on Arrival")
                    .font(.title)
                    .fontWeight(.bold)

                Text("Scan clinician QR code at nurse station")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()

            // QR Scanner
            if viewModel.isScanning {
                QRScannerView(onQRCodeScanned: { qrCode in
                    viewModel.handleScannedQR(qrCode)
                })
                .frame(height: 300)
                .cornerRadius(16)
                .padding()
            } else {
                Button(action: {
                    viewModel.startScanning()
                }) {
                    HStack {
                        Image(systemName: "camera.fill")
                        Text("Start Scanning")
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.blue)
                    )
                }
                .padding()
            }

            // Verification Result
            if let result = viewModel.verificationResult {
                VerificationResultCard(result: result)
                    .padding()
            }

            Spacer()
        }
        .navigationTitle("Verify Arrival")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Verification Complete", isPresented: $viewModel.showSuccessAlert) {
            Button("OK") {
                dismiss()
            }
        } message: {
            Text("Clinician verified and checked in successfully")
        }
        .alert("Error", isPresented: $viewModel.showErrorAlert) {
            Button("OK") { }
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error")
        }
    }
}

// MARK: - QR Scanner View (Placeholder)

struct QRScannerView: UIViewRepresentable {
    let onQRCodeScanned: (String) -> Void

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        // This would integrate with AVFoundation for QR scanning
        // For now, it's a placeholder
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            // Simulate QR scan
            onQRCodeScanned("vitalcv://provider/12345")
        }
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        // Update view if needed
    }
}

// MARK: - Verification Result Card

struct VerificationResultCard: View {
    let result: VerificationResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: result.verified ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(.title)
                    .foregroundColor(result.verified ? .green : .red)

                Text(result.verified ? "Verified" : "Verification Failed")
                    .font(.headline)

                Spacer()
            }

            if let credentialId = result.credentialId {
                Text("Credential ID: \(credentialId)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if !result.checks.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Checks:")
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    ForEach(result.checks) { check in
                        HStack {
                            Image(systemName: check.passed ? "checkmark" : "xmark")
                                .foregroundColor(check.passed ? .green : .red)

                            Text(check.name)
                                .font(.caption)

                            if let message = check.message {
                                Text("(\(message))")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

// MARK: - View Model

@MainActor
class VerifyOnArrivalViewModel: ObservableObject {
    @Published var isScanning = false
    @Published var verificationResult: VerificationResult?
    @Published var showSuccessAlert = false
    @Published var showErrorAlert = false
    @Published var errorMessage: String?

    private let networkService = NetworkService.shared

    func startScanning() {
        isScanning = true
    }

    func handleScannedQR(_ qrCode: String) {
        isScanning = false

        // Parse QR code and verify
        // This would extract provider ID and verify credentials
        if qrCode.contains("provider/") {
            let providerId = qrCode.components(separatedBy: "/").last ?? ""
            verifyProvider(providerId: providerId)
        } else {
            errorMessage = "Invalid QR code format"
            showErrorAlert = true
        }
    }

    private func verifyProvider(providerId: String) {
        // This would call the verification service
        // For now, simulate verification
        networkService.verifyCredential(credentialId: providerId)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                        self?.showErrorAlert = true
                    }
                },
                receiveValue: { [weak self] result in
                    self?.verificationResult = result
                    if result.verified {
                        self?.showSuccessAlert = true
                    } else {
                        self?.errorMessage = result.error ?? "Verification failed"
                        self?.showErrorAlert = true
                    }
                }
            )
            .store(in: &Set<AnyCancellable>())
    }
}

