//
//  VerifyView.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Complete Scanning Engine
//  PHASE 1: Instantaneous, reliable, beautiful QR scanning
//

import SwiftUI
import AVFoundation
import Vision
import CryptoKit

struct VerifyView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = VerifyViewModel()
    @State private var showingPermissionAlert = false
    @State private var parsedPayload: QRPayload?
    @State private var showingUnrecognizedPayload = false

    var body: some View {
        ZStack {
            // Task 1: Full-screen camera preview with AVCaptureSession
            CameraPreviewView(viewModel: viewModel)
                .ignoresSafeArea()

            // Overlay UI
            VStack {
                // Top bar
                HStack {
                    Button("Cancel") {
                        viewModel.stopScanning()
                        dismiss()
                    }
                    .foregroundColor(.white)
                    .font(WalletTypography.headline)
                    .padding()

                    Spacer()

                    // Development mode toggle (Task 15)
                    #if DEBUG
                    Toggle("Dev Mode", isOn: $viewModel.developmentMode)
                        .toggleStyle(SwitchToggleStyle(tint: .white))
                        .padding()
                    #endif
                }
                .background(
                    LinearGradient(
                        colors: [.black.opacity(0.7), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                Spacer()

                // Task 4: Scanning frame with animated bounding box overlay
                ZStack {
                    // Animated corners (Task 4)
                    if let boundingBox = viewModel.detectedBoundingBox {
                        AnimatedBoundingBoxOverlay(boundingBox: boundingBox)
                    }

                    // Scanning frame
                    RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                        .stroke(
                            viewModel.isLockedOn ? Color.green : Color.white,
                            lineWidth: viewModel.isLockedOn ? 4 : 3
                        )
                        .frame(width: 250, height: 250)
                        .overlay(
                            VStack {
                                if let detected = viewModel.detectedFormat {
                                    Text("Detected: \(detected)")
                                        .foregroundColor(.white)
                                        .font(WalletTypography.caption)
                                        .padding(.top, WalletSpacing.sm)
                                }

                                // Task 7: Freeze-frame indicator
                                if viewModel.isFrozen {
                                    Text("✓ Locked")
                                        .foregroundColor(.green)
                                        .font(WalletTypography.caption)
                                        .padding(.top, 4)
                                }
                            }
                        )
                        .scaleEffect(viewModel.isLockedOn ? 1.05 : 1.0)
                        .animation(.spring(response: 0.3), value: viewModel.isLockedOn)
                }

                Spacer()

                // Bottom instructions
                VStack(spacing: WalletSpacing.sm) {
                    if viewModel.isLockedOn {
                        Text("✓ Valid QR code detected")
                            .foregroundColor(.green)
                            .font(WalletTypography.subheadline)
                            .multilineTextAlignment(.center)
                    } else {
                        Text("Position QR code within the frame")
                            .foregroundColor(.white)
                            .font(WalletTypography.subheadline)
                            .multilineTextAlignment(.center)
                    }

                    Text("Scanning for VC, VP, SD-JWT, or OIDC4VP")
                        .foregroundColor(.white.opacity(0.8))
                        .font(WalletTypography.caption)
                        .multilineTextAlignment(.center)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(
                    LinearGradient(
                        colors: [.clear, .black.opacity(0.7)],
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
        .alert("Unrecognized Payload", isPresented: $showingUnrecognizedPayload) {
            Button("OK") {
                viewModel.resumeScanning()
            }
        } message: {
            Text("The QR code format is not recognized. Please scan a valid VC, VP, SD-JWT, or OIDC4VP QR code.")
        }
        .onChange(of: viewModel.parsedPayload) { newValue in
            if let payload = newValue {
                handleParsedPayload(payload)
            }
        }
        .fullScreenCover(item: $parsedPayload) { payload in
            // Task 8: Route to VerificationProcessorViewModel
            VerificationProcessorView(payload: payload)
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

    private func handleParsedPayload(_ payload: QRPayload) {
        // Task 13: Handle unrecognized payload
        if payload.type == .unknown && !viewModel.developmentMode {
            showingUnrecognizedPayload = true
            return
        }

        parsedPayload = payload
    }
}

// MARK: - Task 4: Animated Bounding Box Overlay

struct AnimatedBoundingBoxOverlay: View {
    let boundingBox: CGRect
    @State private var cornerAnimation: CGFloat = 0

    var body: some View {
        GeometryReader { geometry in
            let rect = boundingBox
            let cornerLength: CGFloat = 20

            ZStack {
                // Animated corners
                ForEach(0..<4) { index in
                    CornerView(
                        position: cornerPosition(for: index, in: rect),
                        angle: cornerAngle(for: index),
                        animation: cornerAnimation
                    )
                    .stroke(Color.green, lineWidth: 3)
                }
            }
        }
        .onAppear {
            withAnimation(
                Animation.linear(duration: 1.0)
                    .repeatForever(autoreverses: false)
            ) {
                cornerAnimation = 1.0
            }
        }
    }

    private func cornerPosition(for index: Int, in rect: CGRect) -> CGPoint {
        switch index {
        case 0: return CGPoint(x: rect.minX, y: rect.minY) // Top-left
        case 1: return CGPoint(x: rect.maxX, y: rect.minY) // Top-right
        case 2: return CGPoint(x: rect.maxX, y: rect.maxY) // Bottom-right
        case 3: return CGPoint(x: rect.minX, y: rect.maxY) // Bottom-left
        default: return .zero
        }
    }

    private func cornerAngle(for index: Int) -> Angle {
        switch index {
        case 0: return .degrees(0)      // Top-left
        case 1: return .degrees(90)      // Top-right
        case 2: return .degrees(180)     // Bottom-right
        case 3: return .degrees(270)     // Bottom-left
        default: return .degrees(0)
        }
    }
}

struct CornerView: Shape {
    let position: CGPoint
    let angle: Angle
    var animation: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let cornerLength: CGFloat = 20
        let offset = animation * 5

        path.move(to: position)

        // Draw corner based on angle
        switch Int(angle.degrees) {
        case 0: // Top-left
            path.addLine(to: CGPoint(x: position.x + cornerLength + offset, y: position.y))
            path.move(to: position)
            path.addLine(to: CGPoint(x: position.x, y: position.y + cornerLength + offset))
        case 90: // Top-right
            path.addLine(to: CGPoint(x: position.x - cornerLength - offset, y: position.y))
            path.move(to: position)
            path.addLine(to: CGPoint(x: position.x, y: position.y + cornerLength + offset))
        case 180: // Bottom-right
            path.addLine(to: CGPoint(x: position.x - cornerLength - offset, y: position.y))
            path.move(to: position)
            path.addLine(to: CGPoint(x: position.x, y: position.y - cornerLength - offset))
        case 270: // Bottom-left
            path.addLine(to: CGPoint(x: position.x + cornerLength + offset, y: position.y))
            path.move(to: position)
            path.addLine(to: CGPoint(x: position.x, y: position.y - cornerLength - offset))
        default:
            break
        }

        return path
    }
}

// MARK: - Camera Preview

struct CameraPreviewView: UIViewRepresentable {
    let viewModel: VerifyViewModel

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
class VerifyViewModel: ObservableObject {
    @Published var isScanning: Bool = false
    @Published var parsedPayload: QRPayload?
    @Published var detectedFormat: String?
    @Published var detectedBoundingBox: CGRect?
    @Published var isLockedOn: Bool = false
    @Published var isFrozen: Bool = false
    @Published var scanningPulse: Bool = false
    @Published var developmentMode: Bool = false

    let captureSession = AVCaptureSession()

    // Task 3: QRDetector with UUID-based debouncing
    private let qrDetector = QRDetector()

    // Task 2: High-frequency frame capture pipeline
    private var videoOutput: AVCaptureVideoDataOutput?

    // Task 5: Low-light compensation
    private var videoDevice: AVCaptureDevice?

    func startScanning() {
        guard !isScanning else { return }
        setupCaptureSession()
        isScanning = true

        // Start pulse animation
        withAnimation(
            Animation.easeInOut(duration: 0.8)
                .repeatForever(autoreverses: true)
        ) {
            scanningPulse = true
        }
    }

    func stopScanning() {
        captureSession.stopRunning()
        isScanning = false
        scanningPulse = false
        resetDetectionState()
    }

    func pauseScanning() {
        captureSession.stopRunning()
        isScanning = false
    }

    func resumeScanning() {
        guard !isScanning else { return }
        captureSession.startRunning()
        isScanning = true
        resetDetectionState()
    }

    private func resetDetectionState() {
        isLockedOn = false
        isFrozen = false
        detectedBoundingBox = nil
        detectedFormat = nil
    }

    private func setupCaptureSession() {
        guard let videoDevice = AVCaptureDevice.default(for: .video) else { return }
        self.videoDevice = videoDevice

        do {
            let input = try AVCaptureDeviceInput(device: videoDevice)
            if captureSession.canAddInput(input) {
                captureSession.addInput(input)
            }

            // Task 2: High-frequency frame capture with VideoDataOutput
            let output = AVCaptureVideoDataOutput()
            output.setSampleBufferDelegate(self, queue: DispatchQueue(label: "qr.detection", qos: .userInteractive))
            output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
            output.alwaysDiscardsLateVideoFrames = true // Drop frames for speed

            if captureSession.canAddOutput(output) {
                captureSession.addOutput(output)
                videoOutput = output
            }

            // Task 5: Low-light auto-brightness compensation
            try videoDevice.lockForConfiguration()
            if videoDevice.isLowLightBoostSupported {
                videoDevice.automaticallyEnablesLowLightBoostWhenAvailable = true
            }
            if videoDevice.isExposureModeSupported(.continuousAutoExposure) {
                videoDevice.exposureMode = .continuousAutoExposure
            }
            videoDevice.unlockForConfiguration()

            // Configure for rapid detection
            RapidQRDetectionService.shared.configureForRapidDetection(captureSession)

            DispatchQueue.global(qos: .userInitiated).async {
                self.captureSession.startRunning()
            }
        } catch {
            print("Failed to setup capture session: \(error)")
        }
    }
}

// MARK: - Task 2: VideoDataOutput Delegate

extension VerifyViewModel: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        // Task 3: Use QRDetector with debouncing
        qrDetector.detectQRCode(in: pixelBuffer) { [weak self] result in
            guard let self = self, let result = result else { return }

            Task { @MainActor in
                // Task 6: Haptic feedback on valid QR lock-on
                if !self.isLockedOn && result.isValid {
                    HapticFeedback.shared.play(.impact(style: .soft))
                    self.isLockedOn = true
                }

                // Task 4: Update bounding box
                self.detectedBoundingBox = result.boundingBox

                // Task 7: Freeze frame on valid detection
                if result.isValid && !self.isFrozen {
                    self.isFrozen = true
                    self.pauseScanning()

                    // Parse payload
                    if let payload = self.parsePayload(result.stringValue) {
                        self.detectedFormat = payload.type.rawValue
                        self.parsedPayload = payload
                    }
                }
            }
        }
    }

    private func parsePayload(_ code: String) -> QRPayload? {
        do {
            return try QRTypeDetector.shared.parsePayload(code)
        } catch {
            return nil
        }
    }
}

// MARK: - Task 3: QRDetector with UUID-based Debouncing

class QRDetector {
    private let visionQueue = DispatchQueue(label: "qr.detection", qos: .userInteractive)
    private var lastDetectedUUID: UUID?
    private var lastDetectionTime: Date?
    private let debounceInterval: TimeInterval = 0.3 // 300ms debounce
    private var isProcessing = false

    struct DetectionResult {
        let stringValue: String
        let boundingBox: CGRect
        let isValid: Bool
        let uuid: UUID
    }

    func detectQRCode(in pixelBuffer: CVPixelBuffer, completion: @escaping (DetectionResult?) -> Void) {
        guard !isProcessing else { return }
        isProcessing = true

        visionQueue.async { [weak self] in
            guard let self = self else { return }

            let request = VNDetectBarcodesRequest { request, error in
                self.isProcessing = false

                guard error == nil,
                      let results = request.results as? [VNBarcodeObservation],
                      let firstResult = results.first,
                      let payload = firstResult.payloadStringValue else {
                    DispatchQueue.main.async {
                        completion(nil)
                    }
                    return
                }

                // UUID-based debouncing
                let currentUUID = UUID()
                let now = Date()

                // Check if this is the same QR code (within debounce interval)
                if let lastUUID = self.lastDetectedUUID,
                   let lastTime = self.lastDetectionTime,
                   now.timeIntervalSince(lastTime) < self.debounceInterval {
                    // Same QR code detected again - ignore
                    DispatchQueue.main.async {
                        completion(nil)
                    }
                    return
                }

                self.lastDetectedUUID = currentUUID
                self.lastDetectionTime = now

                // Validate QR code format
                let isValid = self.isValidQRFormat(payload)

                let result = DetectionResult(
                    stringValue: payload,
                    boundingBox: firstResult.boundingBox,
                    isValid: isValid,
                    uuid: currentUUID
                )

                DispatchQueue.main.async {
                    completion(result)
                }
            }

            request.revision = VNDetectBarcodesRequestRevision3
            request.symbologies = [.QR]

            let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])

            do {
                try handler.perform([request])
            } catch {
                self.isProcessing = false
                DispatchQueue.main.async {
                    completion(nil)
                }
            }
        }
    }

    private func isValidQRFormat(_ payload: String) -> Bool {
        // Quick validation - check if it looks like a valid credential format
        return payload.contains("vc") ||
               payload.contains("vp") ||
               payload.contains("jwt") ||
               payload.contains("openid") ||
               payload.hasPrefix("http") ||
               payload.hasPrefix("https")
    }
}

// MARK: - Task 8 & 16: VerificationProcessorView with FlowEngine

struct VerificationProcessorView: View {
    let payload: QRPayload
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = VerificationProcessorViewModel(payload: payload)

    var body: some View {
        NavigationView {
            ZStack {
                Color.walletBackground.ignoresSafeArea()

                if let error = viewModel.error {
                    VStack(spacing: WalletSpacing.lg) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 64))
                            .foregroundColor(.walletError)

                        Text("Verification Failed")
                            .font(WalletTypography.title1)

                        Text(error.localizedDescription)
                            .font(WalletTypography.body)
                            .foregroundColor(.walletTextSecondary)
                            .multilineTextAlignment(.center)
                            .padding()

                        Button("Close") {
                            dismiss()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                } else if let result = viewModel.verificationResult {
                    // Phase 5: Route to VerificationResultView
                    VerificationResultView(result: result)
                } else {
                    VStack(spacing: WalletSpacing.lg) {
                        Text("Processing payload...")
                            .font(WalletTypography.title2)

                        Text("Type: \(payload.type.rawValue)")
                            .font(WalletTypography.body)
                            .foregroundColor(.walletTextSecondary)

                        // Phase 4: Show verification steps
                        VerificationTimelineView(currentStep: viewModel.currentStep)
                            .padding()
                    }
                    .padding()
                }
            }
            .navigationTitle("Verification")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
}

@MainActor
class VerificationProcessorViewModel: ObservableObject {
    @Published var isProcessing = false
    @Published var error: Error?
    @Published var currentStep: VerificationStep = .idle
    @Published var verificationResult: VerificationResult?

    private let flowEngine = VerificationFlowEngine.shared
    private let payloadParser = QRPayloadParser.shared
    let payload: QRPayload

    init(payload: QRPayload) {
        self.payload = payload
        startProcessing()
    }

    private func startProcessing() {
        isProcessing = true

        Task {
            do {
                // Task 16: Parse and normalize payload
                let normalizedPayload = try payloadParser.parsePayload(payload.raw as? String ?? "")

                // Process through verification flow engine
                try await flowEngine.processPayload(normalizedPayload)

                // Observe flow engine state
                flowEngine.$currentStep
                    .assign(to: &$currentStep)

                flowEngine.$verificationResult
                    .compactMap { $0 }
                    .assign(to: &$verificationResult)

                flowEngine.$error
                    .compactMap { $0 }
                    .assign(to: &$error)

            } catch {
                self.error = error
                self.isProcessing = false
            }
        }
    }
}

extension QRPayload: Identifiable {
    public var id: String {
        "\(type.rawValue)-\(UUID().uuidString)"
    }
}
