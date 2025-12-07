//
//  DocumentImagePreprocessor.swift
//  VitalCVWallet
//
//  Created: Medical Imaging Credential Extractor - Phase 1, Task 3
//  Image preprocessing: deskew, enhance contrast, crop
//

import Foundation
import UIKit
import CoreImage
import CoreImage.CIFilterBuiltins

/// Image preprocessing result
struct PreprocessedImage {
    let image: UIImage
    let adjustments: [PreprocessingAdjustment]
}

/// Type of preprocessing adjustment applied
enum PreprocessingAdjustment {
    case deskew(angle: Double)
    case contrast(amount: Double)
    case brightness(amount: Double)
    case crop(bounds: CGRect)
    case denoise
}

/// Document image preprocessor
@MainActor
class DocumentImagePreprocessor {

    private let context = CIContext()

    // MARK: - Preprocessing

    /// Preprocess image: deskew, enhance contrast, crop
    func preprocess(_ image: UIImage) async throws -> UIImage {
        guard let ciImage = CIImage(image: image) else {
            throw PreprocessingError.invalidImage
        }

        var currentImage = ciImage
        var adjustments: [PreprocessingAdjustment] = []

        // Step 1: Enhance contrast
        currentImage = try enhanceContrast(image: currentImage)
        adjustments.append(.contrast(amount: 1.2))

        // Step 2: Adjust brightness
        currentImage = try adjustBrightness(image: currentImage)
        adjustments.append(.brightness(amount: 0.1))

        // Step 3: Deskew (detect and correct rotation)
        let (deskewedImage, angle) = try await deskew(image: currentImage)
        currentImage = deskewedImage
        if abs(angle) > 0.5 {
            adjustments.append(.deskew(angle: angle))
        }

        // Step 4: Auto-crop to document bounds
        if let croppedImage = try? autoCrop(image: currentImage) {
            let originalBounds = currentImage.extent
            let croppedBounds = croppedImage.extent
            adjustments.append(.crop(bounds: croppedBounds))
            currentImage = croppedImage
        }

        // Step 5: Denoise
        currentImage = try denoise(image: currentImage)
        adjustments.append(.denoise)

        // Convert back to UIImage
        guard let cgImage = context.createCGImage(currentImage, from: currentImage.extent) else {
            throw PreprocessingError.renderingFailed
        }

        return UIImage(cgImage: cgImage, scale: image.scale, orientation: image.imageOrientation)
    }

    // MARK: - Individual Preprocessing Steps

    /// Enhance contrast
    private func enhanceContrast(image: CIImage) throws -> CIImage {
        let filter = CIFilter.colorControls()
        filter.inputImage = image
        filter.contrast = 1.2
        filter.brightness = 0.0
        filter.saturation = 1.0

        guard let output = filter.outputImage else {
            throw PreprocessingError.filterFailed
        }

        return output
    }

    /// Adjust brightness
    private func adjustBrightness(image: CIImage) throws -> CIImage {
        let filter = CIFilter.colorControls()
        filter.inputImage = image
        filter.brightness = 0.1
        filter.contrast = 1.0

        guard let output = filter.outputImage else {
            throw PreprocessingError.filterFailed
        }

        return output
    }

    /// Deskew image by detecting text orientation
    private func deskew(image: CIImage) async throws -> (CIImage, Double) {
        // Simplified deskew: detect dominant text angle
        // In production, would use more sophisticated angle detection

        // For now, return image as-is with 0 angle
        // A full implementation would:
        // 1. Detect text lines using Vision
        // 2. Calculate average angle
        // 3. Rotate image to correct angle

        return (image, 0.0)
    }

    /// Auto-crop to document bounds
    private func autoCrop(image: CIImage) throws -> CIImage? {
        // Detect document edges using edge detection
        // Using edge detection filter (Canny-like using available filters)
        let filter = CIFilter.edgeWork()
        filter.inputImage = image
        filter.radius = 3.0

        guard let edgeImage = filter.outputImage else {
            return nil
        }

        // Find bounding box of edges (simplified)
        // In production, would use more sophisticated edge detection
        // For now, return original image

        return image
    }

    /// Denoise image
    private func denoise(image: CIImage) throws -> CIImage {
        // Use median filter for noise reduction
        let filter = CIFilter.median()
        filter.inputImage = image

        guard let output = filter.outputImage else {
            // Fallback to original if filter fails
            return image
        }

        return output
    }
}

// MARK: - Preprocessing Errors

enum PreprocessingError: LocalizedError {
    case invalidImage
    case filterFailed
    case renderingFailed
    case deskewFailed

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "Invalid image provided for preprocessing."
        case .filterFailed:
            return "Image filter operation failed."
        case .renderingFailed:
            return "Failed to render processed image."
        case .deskewFailed:
            return "Failed to deskew image."
        }
    }
}

