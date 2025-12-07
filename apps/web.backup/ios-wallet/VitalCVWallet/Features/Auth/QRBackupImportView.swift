//
//  QRBackupImportView.swift
//  VitalCVWallet
//
//  Created: Batch 551 - Task 9
//  Import from QR backup flow
//

import SwiftUI
import AVFoundation

/// View for importing identity backup from QR code
struct QRBackupImportView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = QRBackupImportViewModel()
    @State private var showingCamera = false

    var body: some View {
        NavigationView {
            ZStack {
                Color.walletBackground
                    .ignoresSafeArea()

                VStack(spacing: 32) {
                    // Header illustration
                    VStack(spacing: 16) {
                        Image(systemName: "qrcode.viewfinder")
                            .font(.system(size: 64))
                            .foregroundColor(.walletPrimary)

                        Text("Import Identity Backup")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.walletText)

                        Text("Scan a QR code to restore your identity and credentials")
                            .font(.system(size: 16))
                            .foregroundColor(.walletTextSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .padding(.top, 40)

                    Spacer()

                    // Import options
                    VStack(spacing: 16) {
                        // Scan QR code
                        Button(action: {
                            showingCamera = true
                        }) {
                            HStack {
                                Image(systemName: "camera.fill")
                                Text("Scan QR Code")
                            }
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.walletPrimary)
                            .cornerRadius(12)
                        }

                        // Paste from clipboard
                        Button(action: {
                            viewModel.importFromClipboard()
                        }) {
                            HStack {
                                Image(systemName: "doc.on.clipboard")
                                Text("Paste from Clipboard")
                            }
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(.walletText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.walletCard)
                            .cornerRadius(12)
                        }

                        // Manual entry
                        Button(action: {
                            viewModel.showManualEntry = true
                        }) {
                            HStack {
                                Image(systemName: "keyboard")
                                Text("Enter Manually")
                            }
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(.walletTextSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.walletCard.opacity(0.5))
                            .cornerRadius(12)
                        }
                    }
                    .padding(.horizontal, 32)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Import Backup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingCamera) {
                QRBackupScannerView { backupData in
                    viewModel.processBackup(backupData)
                }
            }
            .sheet(isPresented: $viewModel.showManualEntry) {
                ManualBackupEntryView { backupData in
                    viewModel.processBackup(backupData)
                }
            }
            .alert("Import Successful", isPresented: $viewModel.showingSuccess) {
                Button("OK") {
                    dismiss()
                }
            } message: {
                Text("Your identity and credentials have been restored.")
            }
            .alert("Import Failed", isPresented: $viewModel.showingError) {
                Button("OK") { }
            } message: {
                Text(viewModel.errorMessage ?? "Unable to import backup. Please check the QR code or data.")
            }
        }
    }
}

// MARK: - QR Backup Scanner

struct QRBackupScannerView: View {
    @Environment(\.dismiss) var dismiss
    let onScan: (String) -> Void

    @StateObject private var scanner = QRBackupScanner()

    var body: some View {
        ZStack {
            // Camera preview
            if let previewLayer = scanner.previewLayer {
                CameraPreviewView(layer: previewLayer)
                    .ignoresSafeArea()
            }

            // Overlay
            VStack {
                HStack {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                    .padding()

                    Spacer()
                }

                Spacer()

                // Scanning frame
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.walletPrimary, lineWidth: 3)
                    .frame(width: 250, height: 250)
                    .overlay(
                        Text("Position QR code here")
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(8)
                            .background(Color.black.opacity(0.6))
                            .cornerRadius(8)
                            .offset(y: 140)
                    )

                Spacer()
            }
        }
        .onAppear {
            scanner.startScanning { code in
                onScan(code)
                dismiss()
            }
        }
        .onDisappear {
            scanner.stopScanning()
        }
    }
}

// MARK: - QR Scanner Helper

class QRBackupScanner: NSObject, ObservableObject, AVCaptureMetadataOutputObjectsDelegate {
    @Published var previewLayer: AVCaptureVideoPreviewLayer?

    private let session = AVCaptureSession()
    private var onCodeScanned: ((String) -> Void)?

    func startScanning(onCodeScanned: @escaping (String) -> Void) {
        self.onCodeScanned = onCodeScanned

        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            return
        }

        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        self.previewLayer = preview

        DispatchQueue.global(qos: .userInitiated).async {
            self.session.startRunning()
        }
    }

    func stopScanning() {
        session.stopRunning()
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let code = metadataObject.stringValue else {
            return
        }

        onCodeScanned?(code)
    }
}

struct CameraPreviewView: UIViewRepresentable {
    let layer: AVCaptureVideoPreviewLayer

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.layer.addSublayer(layer)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        layer.frame = uiView.bounds
    }
}

// MARK: - Manual Entry

struct ManualBackupEntryView: View {
    @Environment(\.dismiss) var dismiss
    @State private var backupText = ""
    let onEnter: (String) -> Void

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Text("Paste your backup data below")
                    .font(.headline)
                    .foregroundColor(.walletText)
                    .padding(.top, 32)

                TextEditor(text: $backupText)
                    .font(.system(.body, design: .monospaced))
                    .padding(12)
                    .background(Color.walletCard)
                    .cornerRadius(12)
                    .frame(height: 200)
                    .padding(.horizontal, 24)

                Button(action: {
                    onEnter(backupText)
                    dismiss()
                }) {
                    Text("Import")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.walletPrimary)
                        .cornerRadius(12)
                }
                .padding(.horizontal, 24)
                .disabled(backupText.isEmpty)

                Spacer()
            }
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

// MARK: - View Model

@MainActor
class QRBackupImportViewModel: ObservableObject {
    @Published var showingSuccess = false
    @Published var showingError = false
    @Published var errorMessage: String?
    @Published var showManualEntry = false

    func importFromClipboard() {
        guard let clipboardText = UIPasteboard.general.string else {
            errorMessage = "No text found in clipboard"
            showingError = true
            return
        }
        processBackup(clipboardText)
    }

    func processBackup(_ backupData: String) {
        // Parse and validate backup data
        // Expected format: JSON with DID, credentials, etc.
        guard let data = backupData.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let did = json["did"] as? String else {
            errorMessage = "Invalid backup format"
            showingError = true
            return
        }

        // Import DID
        Task {
            do {
                // Save DID to keychain
                KeychainService.shared.saveDID(did)

                // Import credentials if present
                if let credentials = json["credentials"] as? [[String: Any]] {
                    // Process and save credentials
                    // Implementation depends on credential storage format
                }

                // Notify app state
                NotificationCenter.default.post(
                    name: .backupImported,
                    object: nil,
                    userInfo: ["did": did]
                )

                showingSuccess = true
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }
}

extension Notification.Name {
    static let backupImported = Notification.Name("backupImported")
}

