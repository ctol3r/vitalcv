//
//  QRScannerView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 21
//  Full-screen QR scanner
//

import SwiftUI
import AVFoundation

struct QRScannerView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var scanner = QRScannerViewModel()
    @State private var showingPermissionAlert = false

    var onScanned: ((String) -> Void)?

    var body: some View {
        ZStack {
            // Camera preview
            QRScannerPreview(scanner: scanner)
                .ignoresSafeArea()

            // Overlay
            VStack {
                // Top bar
                HStack {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                    .padding()

                    Spacer()
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
                RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                    .stroke(Color.white, lineWidth: 3)
                    .frame(width: 250, height: 250)
                    .overlay(
                        VStack {
                            Text("Position QR code here")
                                .foregroundColor(.white)
                                .font(WalletTypography.subheadline)
                                .padding(.top, WalletSpacing.md)
                        }
                    )
                    .background(Color.black.opacity(0.3))

                Spacer()

                // Bottom instructions
                VStack(spacing: WalletSpacing.sm) {
                    Text("Scan a QR code to receive or verify a credential")
                        .foregroundColor(.white)
                        .font(WalletTypography.subheadline)
                        .multilineTextAlignment(.center)
                        .padding()
                }
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
            checkCameraPermission()
        }
        .alert("Camera Permission Required", isPresented: $showingPermissionAlert) {
            Button("Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {
                dismiss()
            }
        } message: {
            Text("Please enable camera access in Settings to scan QR codes.")
        }
        .onChange(of: scanner.scannedCode) { newValue in
            if let code = newValue {
                onScanned?(code)
                dismiss()
            }
        }
    }

    private func checkCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            scanner.startScanning()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    scanner.startScanning()
                } else {
                    showingPermissionAlert = true
                }
            }
        default:
            showingPermissionAlert = true
        }
    }
}

@MainActor
class QRScannerViewModel: ObservableObject {
    @Published var scannedCode: String?

    private let captureSession = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?

    func startScanning() {
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            return
        }

        let videoInput: AVCaptureDeviceInput

        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            return
        }

        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
        }

        let metadataOutput = AVCaptureMetadataOutput()

        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)

            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.qr]
        }

        DispatchQueue.global(qos: .userInitiated).async {
            self.captureSession.startRunning()
        }
    }

    func stopScanning() {
        captureSession.stopRunning()
    }
}

extension QRScannerViewModel: AVCaptureMetadataOutputObjectsDelegate {
    nonisolated func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVCaptureMetadataObject], from connection: AVCaptureConnection) {
        if let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
           let stringValue = metadataObject.stringValue {
            Task { @MainActor in
                self.scannedCode = stringValue
            }
        }
    }
}

struct QRScannerPreview: UIViewRepresentable {
    let scanner: QRScannerViewModel

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)

        let previewLayer = AVCaptureVideoPreviewLayer(session: scanner.captureSession)
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)

        DispatchQueue.main.async {
            previewLayer.frame = view.bounds
        }

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if let previewLayer = uiView.layer.sublayers?.first as? AVCaptureVideoPreviewLayer {
            previewLayer.frame = uiView.bounds
        }
    }
}








