//
//  OCRProcessor.swift
//  VitalCVWallet
//
//  Created: Medical Imaging Credential Extractor - Phase 1, Task 2
//  VisionKit / VNRecognizeTextRequest integration for high-quality OCR
//

import Foundation
import Vision
import VisionKit
import UIKit

/// OCR result with detailed confidence scoring
struct OCRResult {
    let text: String
    let confidence: Double
    let blocks: [OCRBlock]
    let words: [OCRWord]
}

/// OCR text block with bounding box and confidence
struct OCRBlock: Identifiable {
    let id: String
    let text: String
    let boundingBox: CGRect
    let confidence: Double
}

/// OCR word with detailed confidence
struct OCRWord: Identifiable {
    let id: String
    let text: String
    let boundingBox: CGRect
    let confidence: Double
}

/// OCR Processor using Vision framework
@MainActor
class OCRProcessor {

    // MARK: - OCR Configuration

    private let recognitionLevel: VNRequestTextRecognitionLevel = .accurate
    private let usesLanguageCorrection = true

    // MARK: - OCR Processing

    /// Perform OCR on image with detailed confidence scoring
    func performOCR(on image: UIImage) async throws -> OCRResult {
        guard let cgImage = image.cgImage else {
            throw OCRError.invalidImage
        }

        return try await withCheckedThrowingContinuation { continuation in
            let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])

            // Create text recognition request
            let request = VNRecognizeTextRequest { [weak self] request, error in
                guard let self = self else { return }

                if let error = error {
                    continuation.resume(throwing: OCRError.processingFailed(error.localizedDescription))
                    return
                }

                guard let observations = request.results as? [VNRecognizedTextObservation] else {
                    continuation.resume(throwing: OCRError.noTextFound)
                    return
                }

                do {
                    let result = try self.processObservations(observations)
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }

            // Configure request
            request.recognitionLevel = recognitionLevel
            request.usesLanguageCorrection = usesLanguageCorrection

            // Perform request
            do {
                try requestHandler.perform([request])
            } catch {
                continuation.resume(throwing: OCRError.processingFailed(error.localizedDescription))
            }
        }
    }

    // MARK: - Private Processing

    private func processObservations(_ observations: [VNRecognizedTextObservation]) throws -> OCRResult {
        var allText: [String] = []
        var blocks: [OCRBlock] = []
        var words: [OCRWord] = []
        var totalConfidence: Double = 0.0
        var confidenceCount: Int = 0

        for (index, observation) in observations.enumerated() {
            guard let topCandidate = observation.topCandidates(1).first else {
                continue
            }

            let text = topCandidate.string
            let confidence = Double(topCandidate.confidence)

            allText.append(text)
            totalConfidence += confidence
            confidenceCount += 1

            // Create block
            let block = OCRBlock(
                id: "block-\(index)",
                text: text,
                boundingBox: observation.boundingBox,
                confidence: confidence
            )
            blocks.append(block)

            // Extract individual words from this observation
            let wordObservations = observation.topCandidates(1).first?.string.components(separatedBy: .whitespaces) ?? []

            // For simplicity, create word-level entries from the observation
            // In a more sophisticated implementation, we'd use character-level observations
            for (wordIndex, wordText) in wordObservations.enumerated() where !wordText.isEmpty {
                let word = OCRWord(
                    id: "word-\(index)-\(wordIndex)",
                    text: wordText,
                    boundingBox: observation.boundingBox, // Simplified - would need character-level bounds
                    confidence: confidence
                )
                words.append(word)
            }
        }

        // Calculate average confidence
        let averageConfidence = confidenceCount > 0 ? totalConfidence / Double(confidenceCount) : 0.0

        return OCRResult(
            text: allText.joined(separator: "\n"),
            confidence: averageConfidence,
            blocks: blocks,
            words: words
        )
    }
}

// MARK: - OCR Errors

enum OCRError: LocalizedError {
    case invalidImage
    case processingFailed(String)
    case noTextFound

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "Invalid image provided for OCR processing."
        case .processingFailed(let message):
            return "OCR processing failed: \(message)"
        case .noTextFound:
            return "No text found in the image."
        }
    }
}

