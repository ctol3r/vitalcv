//
//  ClipVerifyView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 2 - Task 11
//  VerifyView for App Clip - routes directly to verification
//

import SwiftUI
import AVFoundation
import Vision
import CoreMedia

struct VerifyView: View {
    let payload: QRPayload?
    @EnvironmentObject var clipState: AppClipState
    @StateObject private var viewModel = ClipVerifyViewModel()
    @State private var showingPermissionAlert = false

    var body: some View {
        ZStack {
            if let payload = payload {
                // Direct verification from invocation
                VerificationFlowView(payload: payload)
            } else {
                // Manual scan mode
                CameraScanView(viewModel: viewModel)
            }
        }
        .onAppear {
            if payload == nil {
                checkCameraPermission()
            } else {
                // Start verification immediately
                Task {
                    await viewModel.startVerification(payload: payload!)
                }
            }
        }
        .alert("Camera Permission Required", isPresented: $showingPermissionAlert) {
            Button("Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Please enable camera access to scan QR codes.")
        }
    }

    private func checkCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            viewModel.startScanning()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    viewModel.startScanning()
                } else {
                    showingPermissionAlert = true
                }
            }
        default:
            showingPermissionAlert = true
        }
    }
}

// MARK: - Camera Scan View

struct CameraScanView: View {
    @ObservedObject var viewModel: ClipVerifyViewModel

    var body: some View {
        ZStack {
            CameraPreviewView(viewModel: viewModel)
                .ignoresSafeArea()

            VStack {
                HStack {
                    Spacer()
                    Button("Cancel") {
                        viewModel.stopScanning()
                    }
                    .foregroundColor(.white)
                    .padding()
                }

                Spacer()

                // Scanning frame
                RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                    .stroke(Color.white, lineWidth: 3)
                    .frame(width: 250, height: 250)

                Spacer()

                Text("Position QR code within the frame")
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.black.opacity(0.7))
            }
        }
    }
}

// MARK: - Camera Preview

struct CameraPreviewView: UIViewRepresentable {
    @ObservedObject var viewModel: ClipVerifyViewModel

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        let previewLayer = AVCaptureVideoPreviewLayer(session: viewModel.captureSession)
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

// MARK: - ViewModel

@MainActor
class ClipVerifyViewModel: ObservableObject {
    @Published var isScanning: Bool = false
    @Published var verificationResult: VerificationResult?
    @Published var error: Error?

    let captureSession = AVCaptureSession()
    private let qrDetector = QRDetector()
    private var videoOutput: AVCaptureVideoDataOutput?

    func startScanning() {
        guard !isScanning else { return }
        setupCaptureSession()
        isScanning = true
    }

    func stopScanning() {
        captureSession.stopRunning()
        isScanning = false
    }

    func startVerification(payload: QRPayload) async {
        do {
            let engine = ClipVerificationEngine.shared
            let result = try await engine.verify(payload: payload)
            verificationResult = result
        } catch {
            self.error = error
        }
    }

    private func setupCaptureSession() {
        guard let videoDevice = AVCaptureDevice.default(for: .video) else { return }

        do {
            let input = try AVCaptureDeviceInput(device: videoDevice)
            if captureSession.canAddInput(input) {
                captureSession.addInput(input)
            }

            let output = AVCaptureVideoDataOutput()
            output.setSampleBufferDelegate(self, queue: DispatchQueue(label: "qr.detection"))
            output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]

            if captureSession.canAddOutput(output) {
                captureSession.addOutput(output)
                videoOutput = output
            }

            DispatchQueue.global(qos: .userInitiated).async {
                self.captureSession.startRunning()
            }
        } catch {
            print("Failed to setup capture session: \(error)")
        }
    }
}

extension ClipVerifyViewModel: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        qrDetector.detectQRCode(in: pixelBuffer) { [weak self] result in
            guard let self = self, let result = result, result.isValid else { return }

            Task { @MainActor in
                self.stopScanning()

                do {
                    let payload = try QRTypeDetector.shared.parsePayload(result.stringValue)
                    await self.startVerification(payload: payload)
                } catch {
                    self.error = error
                }
            }
        }
    }
}

