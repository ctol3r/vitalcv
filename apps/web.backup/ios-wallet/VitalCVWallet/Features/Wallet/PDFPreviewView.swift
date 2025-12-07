//
//  PDFPreviewView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 16
//  Native PDF preview for evidence
//

import SwiftUI
import PDFKit
import UniformTypeIdentifiers

struct PDFPreviewView: View {
    let pdfData: Data
    let title: String
    @Environment(\.dismiss) var dismiss
    @State private var scale: CGFloat = 1.0
    @State private var offset: CGSize = .zero

    var body: some View {
        NavigationView {
            ZStack {
                Color.black.ignoresSafeArea()

                PDFKitView(data: pdfData)
                    .scaleEffect(scale)
                    .offset(offset)
                    .gesture(
                        MagnificationGesture()
                            .onChanged { value in
                                scale = value
                            }
                            .onEnded { _ in
                                withAnimation {
                                    if scale < 1.0 {
                                        scale = 1.0
                                    } else if scale > 3.0 {
                                        scale = 3.0
                                    }
                                }
                            }
                    )
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                offset = value.translation
                            }
                            .onEnded { _ in
                                withAnimation {
                                    offset = .zero
                                }
                            }
                    )
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    ShareLink(item: pdfData, preview: SharePreview(title)) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
    }
}

// MARK: - PDFKit View Wrapper

struct PDFKitView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical

        if let document = PDFDocument(data: data) {
            pdfView.document = document
        }

        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {
        // Updates handled automatically
    }
}

// MARK: - Evidence PDF Preview Extension

extension Evidence {
    var pdfData: Data? {
        // In production, fetch PDF from source URL
        // For now, return nil as placeholder
        return nil
    }
}








