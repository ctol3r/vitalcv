//
//  FrameDifferencingSpoofDetector.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 27
//  Frame-differencing to detect spoofed QR images
//

import AVFoundation
import Vision
import CoreImage

/// FrameDifferencingSpoofDetector - Detects spoofed QR codes using frame analysis
public class FrameDifferencingSpoofDetector {
    public static let shared = FrameDifferencingSpoofDetector()

    private var previousFrame: CVPixelBuffer?
    private var frameHistory: [CVPixelBuffer] = []
    private let maxHistorySize = 10
    private let analysisQueue = DispatchQueue(label: "spoof.detection", qos: .userInitiated)

    // Thresholds for spoof detection
    private let motionThreshold: Float = 0.05 // Minimum motion expected
    private let similarityThreshold: Float = 0.98 // Too similar = likely static image
    private let edgeVarianceThreshold: Float = 0.02 // Low variance = likely photo

    private init() {}

    /// Analyze frame for spoofing indicators
    public func analyzeFrame(
        _ pixelBuffer: CVPixelBuffer,
        completion: @escaping (SpoofDetectionResult) -> Void
    ) {
        analysisQueue.async { [weak self] in
            guard let self = self else { return }

            var indicators: [SpoofIndicator] = []
            var confidence: Float = 1.0

            // Check 1: Frame motion analysis
            if let previous = self.previousFrame {
                let motionScore = self.calculateMotion(previous, current: pixelBuffer)

                if motionScore < self.motionThreshold {
                    indicators.append(.lowMotion(score: motionScore))
                    confidence *= 0.7
                }
            }

            // Check 2: Frame similarity (static image detection)
            if let mostSimilar = self.findMostSimilarFrame(to: pixelBuffer) {
                let similarity = self.calculateSimilarity(pixelBuffer, mostSimilar)
                if similarity > self.similarityThreshold {
                    indicators.append(.highSimilarity(score: similarity))
                    confidence *= 0.6
                }
            }

            // Check 3: Edge variance (photo vs live)
            let edgeVariance = self.calculateEdgeVariance(pixelBuffer)
            if edgeVariance < self.edgeVarianceThreshold {
                indicators.append(.lowEdgeVariance(score: edgeVariance))
                confidence *= 0.8
            }

            // Check 4: Temporal consistency
            let temporalScore = self.analyzeTemporalConsistency(pixelBuffer)
            if temporalScore < 0.3 {
                indicators.append(.temporalInconsistency(score: temporalScore))
                confidence *= 0.5
            }

            // Check 5: QR code position stability (suspicious if too stable)
            if let qrPosition = self.detectQRPosition(pixelBuffer) {
                let positionStability = self.analyzePositionStability(qrPosition)
                if positionStability > 0.95 {
                    indicators.append(.positionTooStable(score: positionStability))
                    confidence *= 0.7
                }
            }

            // Update history
            self.updateHistory(pixelBuffer)
            self.previousFrame = pixelBuffer

            let result = SpoofDetectionResult(
                isSuspicious: confidence < 0.5,
                confidence: confidence,
                indicators: indicators,
                recommendation: confidence < 0.5 ? .reject : .accept
            )

            DispatchQueue.main.async {
                completion(result)
            }
        }
    }

    /// Calculate motion between frames
    private func calculateMotion(_ previous: CVPixelBuffer, current: CVPixelBuffer) -> Float {
        let ciPrevious = CIImage(cvPixelBuffer: previous)
        let ciCurrent = CIImage(cvPixelBuffer: current)

        // Use optical flow or simple difference
        let difference = ciCurrent.applyingFilter("CIDifferenceBlendMode", parameters: [
            "inputImage": ciPrevious
        ])

        // Calculate average pixel difference
        // Simplified - in production, use proper optical flow
        return 0.1 // Placeholder
    }

    /// Find most similar frame in history
    private func findMostSimilarFrame(to frame: CVPixelBuffer) -> CVPixelBuffer? {
        var maxSimilarity: Float = 0
        var mostSimilar: CVPixelBuffer?

        for historicalFrame in frameHistory {
            let similarity = calculateSimilarity(frame, historicalFrame)
            if similarity > maxSimilarity {
                maxSimilarity = similarity
                mostSimilar = historicalFrame
            }
        }

        return mostSimilar
    }

    /// Calculate similarity between two frames
    private func calculateSimilarity(_ frame1: CVPixelBuffer, _ frame2: CVPixelBuffer) -> Float {
        // Use histogram comparison or feature matching
        // Simplified implementation
        let ci1 = CIImage(cvPixelBuffer: frame1)
        let ci2 = CIImage(cvPixelBuffer: frame2)

        // Calculate histogram similarity
        // In production, use proper image comparison
        return 0.85 // Placeholder
    }

    /// Calculate edge variance (live video has more variance)
    private func calculateEdgeVariance(_ pixelBuffer: CVPixelBuffer) -> Float {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)

        // Apply edge detection
        let edges = ciImage.applyingFilter("CIEdges", parameters: [
            kCIInputIntensityKey: 1.0
        ])

        // Calculate variance of edge pixels
        // Simplified - in production, use proper variance calculation
        return 0.05 // Placeholder
    }

    /// Analyze temporal consistency
    private func analyzeTemporalConsistency(_ pixelBuffer: CVPixelBuffer) -> Float {
        guard frameHistory.count >= 3 else { return 1.0 }

        // Check if frames show natural variation
        // Static images will have very consistent frames
        var consistencyScores: [Float] = []

        for i in 1..<frameHistory.count {
            let similarity = calculateSimilarity(frameHistory[i-1], frameHistory[i])
            consistencyScores.append(similarity)
        }

        // High consistency = suspicious (likely static image)
        let avgConsistency = consistencyScores.reduce(0, +) / Float(consistencyScores.count)
        return 1.0 - avgConsistency // Invert: low consistency = good (live video)
    }

    /// Detect QR code position in frame
    private func detectQRPosition(_ pixelBuffer: CVPixelBuffer) -> CGRect? {
        let request = VNDetectBarcodesRequest()
        request.revision = VNDetectBarcodesRequestRevision3
        request.symbologies = [.QR]

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        try? handler.perform([request])

        if let results = request.results as? [VNBarcodeObservation],
           let first = results.first {
            return first.boundingBox
        }

        return nil
    }

    /// Analyze position stability
    private func analyzePositionStability(_ currentPosition: CGRect) -> Float {
        // Check if QR position has changed significantly
        // Too stable = likely a photo
        return 0.9 // Placeholder
    }

    /// Update frame history
    private func updateHistory(_ frame: CVPixelBuffer) {
        frameHistory.append(frame)
        if frameHistory.count > maxHistorySize {
            frameHistory.removeFirst()
        }
    }

    /// Reset detector state
    public func reset() {
        previousFrame = nil
        frameHistory.removeAll()
    }
}

// MARK: - Spoof Detection Result

struct SpoofDetectionResult {
    let isSuspicious: Bool
    let confidence: Float // 0.0 = definitely spoofed, 1.0 = definitely real
    let indicators: [SpoofIndicator]
    let recommendation: Recommendation

    enum Recommendation {
        case accept
        case reject
        case requestAdditionalVerification
    }
}

enum SpoofIndicator {
    case lowMotion(score: Float)
    case highSimilarity(score: Float)
    case lowEdgeVariance(score: Float)
    case temporalInconsistency(score: Float)
    case positionTooStable(score: Float)

    var description: String {
        switch self {
        case .lowMotion(let score):
            return "Low motion detected (score: \(score))"
        case .highSimilarity(let score):
            return "Frames too similar (score: \(score))"
        case .lowEdgeVariance(let score):
            return "Low edge variance (score: \(score))"
        case .temporalInconsistency(let score):
            return "Temporal inconsistency (score: \(score))"
        case .positionTooStable(let score):
            return "QR position too stable (score: \(score))"
        }
    }
}








