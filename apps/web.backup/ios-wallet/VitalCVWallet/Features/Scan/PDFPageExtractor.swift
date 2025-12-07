//
//  PDFPageExtractor.swift
//  VitalCVWallet
//
//  Created: Medical Imaging Credential Extractor - Phase 1, Task 4
//  PDF page extractor for multi-page handling
//

import Foundation
import PDFKit
import UIKit

/// PDF extraction result
struct PDFExtractionResult {
    let pages: [PDFPage]
    let pageImages: [UIImage]
    let totalPages: Int
}

/// PDF page extractor for multi-page handling
@MainActor
class PDFPageExtractor {

    // MARK: - Extraction

    /// Extract all pages from PDF document
    func extractAllPages(from pdf: PDFDocument) throws -> PDFExtractionResult {
        let pageCount = pdf.pageCount
        guard pageCount > 0 else {
            throw PDFExtractionError.emptyPDF
        }

        var pages: [PDFPage] = []
        var pageImages: [UIImage] = []

        for index in 0..<pageCount {
            guard let page = pdf.page(at: index) else {
                continue
            }

            pages.append(page)

            // Convert page to image
            if let pageImage = try? extractPageAsImage(page: page) {
                pageImages.append(pageImage)
            }
        }

        return PDFExtractionResult(
            pages: pages,
            pageImages: pageImages,
            totalPages: pageCount
        )
    }

    /// Extract a single page as UIImage
    func extractPageAsImage(page: PDFPage, scale: CGFloat = 2.0) throws -> UIImage {
        let pageRect = page.bounds(for: .mediaBox)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: pageRect.width * scale, height: pageRect.height * scale))

        let image = renderer.image { context in
            // Set white background
            UIColor.white.set()
            context.fill(CGRect(origin: .zero, size: renderer.format.bounds.size))

            // Render PDF page
            context.cgContext.saveGState()
            context.cgContext.scaleBy(x: scale, y: scale)
            page.draw(with: .mediaBox, to: context.cgContext)
            context.cgContext.restoreGState()
        }

        return image
    }

    /// Extract specific page range
    func extractPageRange(from pdf: PDFDocument, range: Range<Int>) throws -> PDFExtractionResult {
        let pageCount = pdf.pageCount
        guard pageCount > 0 else {
            throw PDFExtractionError.emptyPDF
        }

        let validRange = range.clamped(to: 0..<pageCount)

        var pages: [PDFPage] = []
        var pageImages: [UIImage] = []

        for index in validRange {
            guard let page = pdf.page(at: index) else {
                continue
            }

            pages.append(page)

            if let pageImage = try? extractPageAsImage(page: page) {
                pageImages.append(pageImage)
            }
        }

        return PDFExtractionResult(
            pages: pages,
            pageImages: pageImages,
            totalPages: pageCount
        )
    }
}

// MARK: - PDF Extraction Errors

enum PDFExtractionError: LocalizedError {
    case emptyPDF
    case invalidPageIndex
    case renderingFailed

    var errorDescription: String? {
        switch self {
        case .emptyPDF:
            return "PDF document is empty or has no pages."
        case .invalidPageIndex:
            return "Invalid page index specified."
        case .renderingFailed:
            return "Failed to render PDF page as image."
        }
    }
}

