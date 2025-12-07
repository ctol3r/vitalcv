//
//  RapidQRDetectionService.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 21
//  Rapid QR detection tuning (near-instant)
//

import AVFoundation
import Vision

/// RapidQRDetectionService - Optimized QR detection for near-instant scanning
public class RapidQRDetectionService {
    public static let shared = RapidQRDetectionService()

    private let visionQueue = DispatchQueue(label: "qr.detection", qos: .userInteractive)
    private var isProcessing = false

    private init() {}

    /// Detect QR codes in pixel buffer with optimized settings
    public func detectQRCode(
        in pixelBuffer: CVPixelBuffer,
        completion: @escaping (String?) -> Void
    ) {
        // Prevent concurrent processing
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

                DispatchQueue.main.async {
                    completion(payload)
                }
            }

            // Optimize for speed
            request.revision = VNDetectBarcodesRequestRevision3 // Latest, fastest
            request.symbologies = [.QR] // Only QR codes

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

    /// Configure capture session for rapid detection
    public func configureForRapidDetection(_ session: AVCaptureSession) {
        // Use highest quality for better detection
        if session.canSetSessionPreset(.high) {
            session.sessionPreset = .high
        }

        // Optimize device settings
        if let device = AVCaptureDevice.default(for: .video) {
            do {
                try device.lockForConfiguration()

                // Auto-focus for faster detection
                if device.isFocusModeSupported(.continuousAutoFocus) {
                    device.focusMode = .continuousAutoFocus
                }

                // Auto-exposure
                if device.isExposureModeSupported(.continuousAutoExposure) {
                    device.exposureMode = .continuousAutoExposure
                }

                // Optimize frame rate (balance between speed and battery)
                if let format = device.activeFormat.videoSupportedFrameRateRanges.first {
                    device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: Int32(format.maxFrameRate))
                }

                device.unlockForConfiguration()
            } catch {
                // Handle error
            }
        }
    }
}

// MARK: - Enhanced QR Scanner ViewModel

extension QRScannerViewModel {
    /// Enhanced start scanning with rapid detection
    func startRapidScanning() {
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

        // Configure for rapid detection
        RapidQRDetectionService.shared.configureForRapidDetection(captureSession)

        // Use Vision framework for faster detection
        let videoOutput = AVCaptureVideoDataOutput()
        videoOutput.setSampleBufferDelegate(self, queue: DispatchQueue(label: "video.queue", qos: .userInteractive))
        videoOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]

        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
        }

        // Also keep metadata output as fallback
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
}

extension QRScannerViewModel: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        RapidQRDetectionService.shared.detectQRCode(in: pixelBuffer) { [weak self] code in
            guard let code = code else { return }
            Task { @MainActor in
                self?.scannedCode = code
            }
        }
    }
}

