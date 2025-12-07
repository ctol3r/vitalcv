//
//  FailSoftScanningView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 22
//  Fail-soft scanning fallback
//

import SwiftUI

/// FailSoftScanningView - Scanning with graceful fallback options
struct FailSoftScanningView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var scanner = QRScannerViewModel()
    @State private var scanAttempts = 0
    @State private var showingManualEntry = false
    @State private var showingImagePicker = false
    @State private var manualCode: String = ""

    private let maxAttempts = 3

    var onScanned: ((String) -> Void)?

    var body: some View {
        ZStack {
            // Camera preview
            QRScannerPreview(scanner: scanner)
                .ignoresSafeArea()

            // Overlay
            VStack {
                // Top bar with fallback options
                HStack {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                    .padding()

                    Spacer()

                    // Fallback menu
                    Menu {
                        Button("Enter Code Manually") {
                            showingManualEntry = true
                        }

                        Button("Select from Photos") {
                            showingImagePicker = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(.white)
                            .padding()
                    }
                }
                .background(
                    LinearGradient(
                        colors: [.black.opacity(0.6), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                Spacer()

                // Scanning frame
                VStack(spacing: WalletSpacing.md) {
                    RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                        .stroke(scanAttempts >= maxAttempts ? Color.walletError : Color.white, lineWidth: 3)
                        .frame(width: 250, height: 250)
                        .overlay(
                            VStack {
                                if scanAttempts >= maxAttempts {
                                    VStack(spacing: WalletSpacing.sm) {
                                        Image(systemName: "exclamationmark.triangle.fill")
                                            .foregroundColor(.walletError)
                                        Text("Having trouble scanning?")
                                            .foregroundColor(.white)
                                            .font(WalletTypography.subheadline)
                                        Text("Try manual entry or select from photos")
                                            .foregroundColor(.white.opacity(0.8))
                                            .font(WalletTypography.caption)
                                    }
                                } else {
                                    Text("Position QR code here")
                                        .foregroundColor(.white)
                                        .font(WalletTypography.subheadline)
                                }
                            }
                            .padding(.top, WalletSpacing.md)
                        )
                        .background(Color.black.opacity(0.3))

                    // Attempt counter
                    if scanAttempts > 0 {
                        Text("Attempt \(scanAttempts)/\(maxAttempts)")
                            .foregroundColor(.white.opacity(0.7))
                            .font(WalletTypography.caption)
                    }
                }

                Spacer()

                // Bottom instructions with fallback hints
                VStack(spacing: WalletSpacing.sm) {
                    Text("Scan a QR code to receive or verify a credential")
                        .foregroundColor(.white)
                        .font(WalletTypography.subheadline)
                        .multilineTextAlignment(.center)

                    if scanAttempts >= maxAttempts {
                        HStack(spacing: WalletSpacing.md) {
                            Button("Enter Manually") {
                                showingManualEntry = true
                            }
                            .buttonStyle(.borderedProminent)

                            Button("From Photos") {
                                showingImagePicker = true
                            }
                            .buttonStyle(.bordered)
                        }
                        .padding(.top, WalletSpacing.sm)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(
                    LinearGradient(
                        colors: [.clear, .black.opacity(0.6)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
        }
        .onAppear {
            scanner.startRapidScanning()
        }
        .onChange(of: scanner.scannedCode) { newValue in
            if let code = newValue {
                onScanned?(code)
                dismiss()
            } else {
                scanAttempts += 1
            }
        }
        .sheet(isPresented: $showingManualEntry) {
            ManualCodeEntryView(code: $manualCode) { code in
                onScanned?(code)
                dismiss()
            }
        }
        .sheet(isPresented: $showingImagePicker) {
            ImagePickerView { image in
                // Extract QR code from image
                if let code = extractQRCode(from: image) {
                    onScanned?(code)
                    dismiss()
                }
            }
        }
    }

    private func extractQRCode(from image: UIImage) -> String? {
        // Use Vision framework to detect QR code in image
        guard let ciImage = CIImage(image: image) else { return nil }

        let request = VNDetectBarcodesRequest()
        let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])

        do {
            try handler.perform([request])
            if let result = request.results?.first as? VNBarcodeObservation,
               let payload = result.payloadStringValue {
                return payload
            }
        } catch {
            // Handle error
        }

        return nil
    }
}

// MARK: - Manual Code Entry

struct ManualCodeEntryView: View {
    @Binding var code: String
    @Environment(\.dismiss) var dismiss
    let onEntered: (String) -> Void

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.lg) {
                Text("Enter QR Code Manually")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                TextField("Paste QR code content here", text: $code, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .padding()

                Button("Submit") {
                    guard !code.isEmpty else { return }
                    onEntered(code)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .disabled(code.isEmpty)
            }
            .padding()
            .navigationTitle("Manual Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Image Picker

import PhotosUI

struct ImagePickerView: View {
    @Environment(\.dismiss) var dismiss
    @State private var selectedItem: PhotosPickerItem?
    let onImageSelected: (UIImage) -> Void

    var body: some View {
        NavigationView {
            PhotosPicker(selection: $selectedItem, matching: .images) {
                VStack(spacing: WalletSpacing.lg) {
                    Image(systemName: "photo.on.rectangle")
                        .font(.system(size: 64))
                        .foregroundColor(.walletPrimary)

                    Text("Select QR Code Image")
                        .font(WalletTypography.headline)

                    Text("Choose an image containing a QR code from your photos")
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            }
            .navigationTitle("Select Image")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onChange(of: selectedItem) { newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        onImageSelected(image)
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    FailSoftScanningView()
}

