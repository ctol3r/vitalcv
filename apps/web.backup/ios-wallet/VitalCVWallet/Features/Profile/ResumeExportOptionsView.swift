//
//  ResumeExportOptionsView.swift
//  VitalCVWallet
//
//  Created: Smart Resume Generator - Phase 4
//  Export options: Save to Files, AirDrop, Email, Secure Share Link
//

import SwiftUI
import UniformTypeIdentifiers

/// ResumeExportOptionsView - Export resume as PDF with various sharing options (Task 30)
struct ResumeExportOptionsView: View {
    let resume: ResumeModel
    let configuration: ResumeConfiguration
    @Environment(\.dismiss) var dismiss

    @StateObject private var renderer = ResumePDFRenderer()
    @State private var isGenerating = false
    @State private var pdfData: Data?
    @State private var showingShareSheet = false
    @State private var showingSavePanel = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            List {
                Section {
                    if isGenerating {
                        HStack {
                            ProgressView()
                            Text("Generating PDF...")
                                .padding(.leading, WalletSpacing.sm)
                        }
                    } else if pdfData != nil {
                        successSection
                    } else {
                        generateSection
                    }
                }

                if pdfData != nil {
                    Section("Export Options") {
                        // Save to Files (Task 30)
                        Button(action: saveToFiles) {
                            ExportOptionRow(
                                icon: "folder.fill",
                                title: "Save to Files",
                                subtitle: "Save PDF to your device"
                            )
                        }

                        // AirDrop (Task 30)
                        Button(action: shareViaAirDrop) {
                            ExportOptionRow(
                                icon: "airplayaudio",
                                title: "AirDrop",
                                subtitle: "Share via AirDrop"
                            )
                        }

                        // Email (Task 30)
                        Button(action: shareViaEmail) {
                            ExportOptionRow(
                                icon: "envelope.fill",
                                title: "Email",
                                subtitle: "Send as email attachment"
                            )
                        }

                        // Secure Share Link (Task 30)
                        Button(action: generateShareLink) {
                            ExportOptionRow(
                                icon: "link",
                                title: "Secure Share Link",
                                subtitle: "Generate DPoP-bound verification URL"
                            )
                        }
                    }
                }

                if let error = errorMessage {
                    Section {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.walletError)
                            Text(error)
                                .foregroundColor(.walletError)
                        }
                    }
                }
            }
            .navigationTitle("Export Resume")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .sheet(isPresented: $showingShareSheet) {
            if let pdfData = pdfData {
                ShareSheet(activityItems: [pdfData])
            }
        }
    }

    // MARK: - Generate Section

    private var generateSection: some View {
        Button(action: generatePDF) {
            VStack(spacing: WalletSpacing.sm) {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.walletPrimary)

                Text("Generate PDF")
                    .font(WalletTypography.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(WalletSpacing.lg)
        }
    }

    // MARK: - Success Section

    private var successSection: some View {
        HStack {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.walletSuccess)

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text("PDF Ready")
                    .font(WalletTypography.headline)
                Text("Choose an export option below")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
    }

    // MARK: - Actions

    private func generatePDF() {
        isGenerating = true
        errorMessage = nil

        Task {
            do {
                let data = try await renderer.renderToPDF(
                    resume: resume,
                    configuration: configuration
                )

                await MainActor.run {
                    self.pdfData = data
                    self.isGenerating = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = "Failed to generate PDF: \(error.localizedDescription)"
                    self.isGenerating = false
                }
            }
        }
    }

    private func saveToFiles() {
        guard let pdfData = pdfData else { return }

        let fileName = "\(resume.name.replacingOccurrences(of: " ", with: "_"))_Resume.pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try pdfData.write(to: url)

            let activityVC = UIActivityViewController(
                activityItems: [url],
                applicationActivities: nil
            )

            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let rootViewController = windowScene.windows.first?.rootViewController {
                rootViewController.present(activityVC, animated: true)
            }
        } catch {
            errorMessage = "Failed to save PDF: \(error.localizedDescription)"
        }
    }

    private func shareViaAirDrop() {
        showingShareSheet = true
    }

    private func shareViaEmail() {
        guard let pdfData = pdfData else { return }

        let fileName = "\(resume.name.replacingOccurrences(of: " ", with: "_"))_Resume.pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try pdfData.write(to: url)

            let mailURL = URL(string: "mailto:?subject=My%20Resume&body=Please%20find%20my%20resume%20attached&attachment=\(url.absoluteString)")!

            if UIApplication.shared.canOpenURL(mailURL) {
                UIApplication.shared.open(mailURL)
            } else {
                showingShareSheet = true
            }
        } catch {
            errorMessage = "Failed to prepare email: \(error.localizedDescription)"
        }
    }

    private func generateShareLink() {
        // Task 29: Generate DPoP-bound URL for share link verification
        // Placeholder - would generate secure verification link
        errorMessage = "Secure share link generation coming soon"
    }
}

// MARK: - Export Option Row

private struct ExportOptionRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            Image(systemName: icon)
                .foregroundColor(.walletPrimary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(title)
                    .font(WalletTypography.subheadline)
                Text(subtitle)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.walletTextSecondary)
                .font(.system(size: 12))
        }
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: activityItems,
            applicationActivities: nil
        )
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    ResumeExportOptionsView(
        resume: ResumeModel(
            clinicianId: "test",
            name: "Dr. Jane Smith",
            degree: "MD",
            specialty: "Emergency Medicine"
        ),
        configuration: ResumeConfiguration()
    )
}








