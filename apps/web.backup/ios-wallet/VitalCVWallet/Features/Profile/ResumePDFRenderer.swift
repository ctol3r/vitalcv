//
//  ResumePDFRenderer.swift
//  VitalCVWallet
//
//  Created: Smart Resume Generator - Phase 4
//  PDF rendering from SwiftUI resume views
//

import SwiftUI
import PDFKit
import CoreGraphics
import CoreImage

/// ResumePDFRenderer - Renders SwiftUI resume views to PDF
@MainActor
class ResumePDFRenderer: ObservableObject {

    /// Render resume to PDF data
    func renderToPDF(
        resume: ResumeModel,
        configuration: ResumeConfiguration
    ) async throws -> Data {
        let renderer = ImageRenderer(content: ResumePDFContentView(
            resume: resume,
            configuration: configuration
        ))

        // Set PDF page size (US Letter: 8.5 x 11 inches)
        let pageSize = CGSize(width: 612, height: 792) // 8.5" x 11" at 72 DPI

        renderer.proposedSize = .init(pageSize)

        // Create PDF metadata
        let pdfMetaData = [
            kCGPDFContextCreator: "VitalCV Smart Resume Generator",
            kCGPDFContextAuthor: resume.name,
            kCGPDFContextTitle: "\(resume.name) - Resume"
        ]

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData as [String: Any]

        let pdfRenderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize), format: format)

        let pdfData = pdfRenderer.pdfData { context in
            // Render multiple pages if needed (Task 27)
            var currentPage = 0
            var yOffset: CGFloat = 0

            while currentPage == 0 || yOffset > 0 {
                context.beginPage()

                let pageRect = context.pdfContextBounds
                yOffset = renderResumePage(
                    context: context,
                    resume: resume,
                    configuration: configuration,
                    pageRect: pageRect,
                    yOffset: currentPage == 0 ? 0 : yOffset
                )

                // Add chain integrity footer (Task 31)
                if currentPage == 0 || yOffset <= 0 {
                    renderChainFooter(
                        context: context,
                        resume: resume,
                        pageRect: pageRect
                    )
                }

                currentPage += 1

                // Prevent infinite loop
                if currentPage > 10 {
                    break
                }
            }
        }

        return pdfData
    }

    private func renderResumePage(
        context: UIGraphicsPDFRendererContext,
        resume: ResumeModel,
        configuration: ResumeConfiguration,
        pageRect: CGRect,
        yOffset: CGFloat
    ) -> CGFloat {
        // This would integrate with actual SwiftUI rendering
        // For now, placeholder implementation
        var currentY: CGFloat = yOffset + 40

        // Render header
        currentY += 100

        // Render sections based on configuration
        if !resume.licensure.isEmpty {
            currentY += 200
        }

        if !resume.employment.isEmpty {
            currentY += 300
        }

        // Check if content exceeds page
        if currentY > pageRect.height - 100 {
            return currentY - pageRect.height + 100
        }

        return 0
    }

    private func renderChainFooter(
        context: UIGraphicsPDFRendererContext,
        resume: ResumeModel,
        pageRect: CGRect
    ) {
        let footerRect = CGRect(
            x: pageRect.origin.x + 40,
            y: pageRect.height - 60,
            width: pageRect.width - 80,
            height: 40
        )

        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8),
            .foregroundColor: UIColor.gray
        ]

        var footerText = "Chain-Anchored Credential Portfolio"

        if let hash = resume.didHash {
            footerText += " | DID: \(String(hash.prefix(16)))..."
        }

        if let blockNumber = resume.anchorIntegritySummary.chainBlockNumber {
            footerText += " | Block: \(blockNumber)"
        }

        if let timestamp = resume.updatedAt as Date? {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
            footerText += " | Generated: \(formatter.string(from: timestamp))"
        }

        footerText.draw(in: footerRect, withAttributes: attributes)
    }
}

/// SwiftUI view for PDF rendering (Task 25)
struct ResumePDFContentView: View {
    let resume: ResumeModel
    let configuration: ResumeConfiguration

    var body: some View {
        VStack(spacing: 0) {
            // Header
            PDFHeaderView(resume: resume, configuration: configuration)

            // Content sections
            PDFContentView(resume: resume, configuration: configuration)

            // QR Code (Task 28)
            PDFQRCodeView(resume: resume)
        }
    }
}

private struct PDFHeaderView: View {
    let resume: ResumeModel
    let configuration: ResumeConfiguration

    var body: some View {
        VStack(spacing: 8) {
            Text(resume.name)
                .font(.system(size: 24, weight: .bold))

            if let specialty = resume.specialty {
                Text(specialty)
                    .font(.system(size: 16))
            }

            if let headline = resume.headlineSummary {
                Text(headline)
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }
}

private struct PDFContentView: View {
    let resume: ResumeModel
    let configuration: ResumeConfiguration

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Credentials
            if !resume.licensure.isEmpty {
                PDFSection(title: "Licensure") {
                    ForEach(resume.licensure) { license in
                        PDFCredentialItem(
                            title: "\(license.type) - \(license.state)",
                            subtitle: license.number,
                            status: license.status
                        )
                    }
                }
            }

            // Employment
            if !resume.employment.isEmpty {
                PDFSection(title: "Experience") {
                    ForEach(resume.employment) { employment in
                        PDFEmploymentItem(employment: employment)
                    }
                }
            }

            // Education
            if !resume.education.isEmpty {
                PDFSection(title: "Education") {
                    ForEach(resume.education) { education in
                        PDFEducationItem(education: education)
                    }
                }
            }
        }
        .padding(.horizontal, 40)
    }
}

private struct PDFSection<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .padding(.bottom, 4)

            content
        }
    }
}

private struct PDFCredentialItem: View {
    let title: String
    let subtitle: String
    let status: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12))
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }

            Spacer()

            Text(status)
                .font(.system(size: 10))
                .foregroundColor(.gray)
        }
        .padding(.vertical, 4)
    }
}

private struct PDFEmploymentItem: View {
    let employment: Employment

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(employment.title)
                .font(.system(size: 12, weight: .semibold))

            Text(employment.organization)
                .font(.system(size: 11))

            Text(formatDateRange(employment.startDate, employment.endDate))
                .font(.system(size: 10))
                .foregroundColor(.gray)
        }
        .padding(.vertical, 4)
    }

    private func formatDateRange(_ start: Date, _ end: Date?) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        let startStr = formatter.string(from: start)
        let endStr = end.map { formatter.string(from: $0) } ?? "Present"
        return "\(startStr) - \(endStr)"
    }
}

private struct PDFEducationItem: View {
    let education: Education

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(education.degree)
                .font(.system(size: 12, weight: .semibold))

            Text(education.institution)
                .font(.system(size: 11))

            if let year = education.yearGraduated {
                Text("\(year)")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
        }
        .padding(.vertical, 4)
    }
}

/// QR Code view for PDF (Task 28)
private struct PDFQRCodeView: View {
    let resume: ResumeModel

    var body: some View {
        VStack(spacing: 8) {
            if let qrImage = generateQRCode(for: resume) {
                Image(uiImage: qrImage)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100, height: 100)
            }

            Text("Scan to verify credentials")
                .font(.system(size: 8))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    private func generateQRCode(for resume: ResumeModel) -> UIImage? {
        // Generate QR code linking to chain-verified portfolio
        let urlString = "https://vitalcv.app/verify/\(resume.id)"
        guard let url = URL(string: urlString),
              let data = urlString.data(using: .utf8) else {
            return nil
        }

        // Use Core Image to generate QR code
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")

        guard let qrImage = filter.outputImage else { return nil }

        let transform = CGAffineTransform(scaleX: 10, y: 10)
        let scaledImage = qrImage.transformed(by: transform)

        let context = CIContext()
        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}

