//
//  DocumentCaptureEngine.swift
//  VitalCVWallet
//
//  Created: Medical Imaging Credential Extractor - Phase 1, Task 1
//  Document capture engine with camera, file import, and PDF import modes
//

import Foundation
import SwiftUI
import VisionKit
import Vision
import UniformTypeIdentifiers
import PDFKit

/// Document capture modes
enum DocumentCaptureMode {
    case camera
    case fileImport
    case pdfImport
}

/// Document capture result
struct DocumentCaptureResult {
    let id: String
    let mode: DocumentCaptureMode
    let originalImage: UIImage?
    let originalPDF: PDFDocument?
    let processedImage: UIImage?
    let ocrText: String?
    let confidence: Double
    let captureDate: Date
    let fileHash: String // SHA256 digest
}

/// Document capture engine coordinator
@MainActor
class DocumentCaptureEngine: ObservableObject {

    // MARK: - Published Properties

    @Published var captureMode: DocumentCaptureMode = .camera
    @Published var isCapturing = false
    @Published var capturedDocument: DocumentCaptureResult?
    @Published var error: CaptureError?

    // MARK: - Private Properties

    private let ocrProcessor = OCRProcessor()
    private let imagePreprocessor = DocumentImagePreprocessor()
    private let pdfExtractor = PDFPageExtractor()

    // MARK: - Capture Methods

    /// Capture document from camera
    func captureFromCamera(image: UIImage) async throws {
        isCapturing = true
        defer { isCapturing = false }

        do {
            // Preprocess image
            let processedImage = try await imagePreprocessor.preprocess(image)

            // Generate hash of original
            let fileHash = try generateFileHash(from: image)

            // Perform OCR
            let ocrResult = try await ocrProcessor.performOCR(on: processedImage)

            let result = DocumentCaptureResult(
                id: UUID().uuidString,
                mode: .camera,
                originalImage: image,
                originalPDF: nil,
                processedImage: processedImage,
                ocrText: ocrResult.text,
                confidence: ocrResult.confidence,
                captureDate: Date(),
                fileHash: fileHash
            )

            capturedDocument = result
        } catch {
            self.error = .captureFailed(error.localizedDescription)
            throw error
        }
    }

    /// Import document from file picker
    func importFromFile(data: Data, filename: String) async throws {
        isCapturing = true
        defer { isCapturing = false }

        do {
            // Check if it's a PDF
            if filename.lowercased().hasSuffix(".pdf") {
                try await importPDF(data: data)
            } else {
                // Assume it's an image
                guard let image = UIImage(data: data) else {
                    throw CaptureError.invalidFileFormat
                }
                try await captureFromCamera(image: image)
            }
        } catch {
            self.error = .importFailed(error.localizedDescription)
            throw error
        }
    }

    /// Import PDF document
    func importPDF(data: Data) async throws {
        guard let pdfDocument = PDFDocument(data: data) else {
            throw CaptureError.invalidPDFFormat
        }

        isCapturing = true
        defer { isCapturing = false }

        do {
            // Extract first page for OCR (can be extended for multi-page)
            guard let firstPage = pdfDocument.page(at: 0) else {
                throw CaptureError.emptyPDF
            }

            // Convert PDF page to image
            let pageImage = try await pdfExtractor.extractPageAsImage(page: firstPage)

            // Preprocess
            let processedImage = try await imagePreprocessor.preprocess(pageImage)

            // Generate hash
            let fileHash = try generateFileHash(from: pdfDocument)

            // Perform OCR
            let ocrResult = try await ocrProcessor.performOCR(on: processedImage)

            let result = DocumentCaptureResult(
                id: UUID().uuidString,
                mode: .pdfImport,
                originalImage: nil,
                originalPDF: pdfDocument,
                processedImage: processedImage,
                ocrText: ocrResult.text,
                confidence: ocrResult.confidence,
                captureDate: Date(),
                fileHash: fileHash
            )

            capturedDocument = result
        } catch {
            self.error = .importFailed(error.localizedDescription)
            throw error
        }
    }

    // MARK: - Private Helpers

    private func generateFileHash(from image: UIImage) throws -> String {
        guard let imageData = image.jpegData(compressionQuality: 1.0) else {
            throw CaptureError.hashGenerationFailed
        }
        return SHA256Digest.digest(data: imageData)
    }

    private func generateFileHash(from pdf: PDFDocument) throws -> String {
        guard let pdfData = pdf.dataRepresentation() else {
            throw CaptureError.hashGenerationFailed
        }
        return SHA256Digest.digest(data: pdfData)
    }
}

// MARK: - Capture Errors

enum CaptureError: LocalizedError {
    case captureFailed(String)
    case importFailed(String)
    case invalidFileFormat
    case invalidPDFFormat
    case emptyPDF
    case hashGenerationFailed

    var errorDescription: String? {
        switch self {
        case .captureFailed(let message):
            return "Capture failed: \(message)"
        case .importFailed(let message):
            return "Import failed: \(message)"
        case .invalidFileFormat:
            return "Invalid file format. Please use PNG, JPEG, or PDF."
        case .invalidPDFFormat:
            return "Invalid PDF format."
        case .emptyPDF:
            return "PDF document is empty."
        case .hashGenerationFailed:
            return "Failed to generate file hash."
        }
    }
}

// MARK: - SHA256 Digest Helper

enum SHA256Digest {
    static func digest(data: Data) -> String {
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}

// Import CommonCrypto for SHA256
import CommonCrypto

