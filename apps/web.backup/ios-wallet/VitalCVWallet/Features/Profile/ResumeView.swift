//
//  ResumeView.swift
//  VitalCVWallet
//
//  Created: Smart Resume Generator - Phase 1
//  Main Resume view with generation and preview
//

import SwiftUI

/// ResumeView - Main view for resume generation and management
struct ResumeView: View {
    @EnvironmentObject var appState: AppStateContainer
    @StateObject private var engine = ResumeEngine()
    @StateObject private var viewModel = ResumeViewModel()
    @State private var resume: ResumeModel?
    @State private var isGenerating = false
    @State private var showingPreview = false
    @State private var showingCustomization = false
    @State private var showingExportOptions = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.lg) {
                    // Header section
                    headerSection

                    // Generate/Preview section
                    if let resume = resume {
                        resumeReadySection(resume: resume)
                    } else {
                        generateSection
                    }

                    // Error message
                    if let error = errorMessage {
                        errorSection(error: error)
                    }
                }
                .padding(WalletSpacing.md)
            }
            .navigationTitle("Smart Resume")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if resume != nil {
                        Button(action: {
                            showingCustomization = true
                        }) {
                            Image(systemName: "slider.horizontal.3")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingPreview) {
                if let resume = resume {
                    ResumePreviewView(resume: resume, configuration: viewModel.configuration)
                }
            }
            .sheet(isPresented: $showingCustomization) {
                if let resume = resume {
                    ResumeCustomizationView(
                        resume: resume,
                        configuration: $viewModel.configuration,
                        onUpdate: { updatedConfig in
                            viewModel.configuration = updatedConfig
                        }
                    )
                }
            }
            .sheet(isPresented: $showingExportOptions) {
                if let resume = resume {
                    ResumeExportOptionsView(resume: resume, configuration: viewModel.configuration)
                }
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Your Smart Resume")
                .font(WalletTypography.title1)

            Text("Generate a professional, chain-verified résumé from your credentials. PDF-ready and recruiter-approved.")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Generate Section

    private var generateSection: some View {
        VStack(spacing: WalletSpacing.md) {
            Image(systemName: "doc.text.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletPrimary)
                .padding(.bottom, WalletSpacing.md)

            Button(action: generateResume) {
                HStack {
                    if isGenerating {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "sparkles")
                        Text("Generate Resume")
                            .font(WalletTypography.headline)
                    }
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isGenerating ? Color.gray : Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.medium)
            }
            .disabled(isGenerating)

            Text("Your resume will be built from your verified credentials in your wallet.")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(WalletSpacing.xl)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    // MARK: - Resume Ready Section

    private func resumeReadySection(resume: ResumeModel) -> some View {
        VStack(spacing: WalletSpacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(resume.name)
                        .font(WalletTypography.title2)

                    if let specialty = resume.specialty {
                        Text(specialty)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                    }

                    if let headline = resume.headlineSummary {
                        Text(headline)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                            .padding(.top, WalletSpacing.xs)
                    }
                }

                Spacer()

                // Trust score indicator
                VStack(spacing: WalletSpacing.xs) {
                    Text("\(Int(resume.trustScore))")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletPrimary)
                    Text("Trust")
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            Divider()

            // Quick stats
            HStack(spacing: WalletSpacing.lg) {
                StatItem(
                    icon: "shield.checkered",
                    label: "Credentials",
                    value: "\(resume.anchorIntegritySummary.totalCredentials)"
                )

                StatItem(
                    icon: "link",
                    label: "Anchored",
                    value: "\(resume.anchorIntegritySummary.totalAnchored)"
                )

                StatItem(
                    icon: "briefcase.fill",
                    label: "Experience",
                    value: "\(calculateYearsExperience(from: resume.employment))y"
                )
            }

            Divider()

            // Action buttons
            HStack(spacing: WalletSpacing.md) {
                Button(action: {
                    showingPreview = true
                }) {
                    Label("Preview", systemImage: "eye.fill")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletPrimary)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary.opacity(0.1))
                        .cornerRadius(WalletCornerRadius.medium)
                }

                Button(action: {
                    showingExportOptions = true
                }) {
                    Label("Export PDF", systemImage: "square.and.arrow.up.fill")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary)
                        .cornerRadius(WalletCornerRadius.medium)
                }
            }
        }
        .padding(WalletSpacing.lg)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    // MARK: - Error Section

    private func errorSection(error: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.walletError)
            Text(error)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletError)
        }
        .padding()
        .background(Color.walletError.opacity(0.1))
        .cornerRadius(WalletCornerRadius.medium)
    }

    // MARK: - Helper Methods

    private func generateResume() {
        isGenerating = true
        errorMessage = nil

        Task {
            do {
                // Get credentials
                let credentials = appState.credentials

                guard !credentials.isEmpty else {
                    errorMessage = "No credentials found. Please add credentials to your wallet first."
                    isGenerating = false
                    return
                }

                // Build clinician info from available data
                let clinicianInfo = buildClinicianInfo(from: credentials)

                // Generate resume
                let generatedResume = await engine.generateResume(
                    from: credentials,
                    clinicianInfo: clinicianInfo,
                    configuration: viewModel.configuration
                )

                await MainActor.run {
                    self.resume = generatedResume
                    self.isGenerating = false

                    // Show notification (Phase 5)
                    viewModel.notifyResumeReady()
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = "Failed to generate resume: \(error.localizedDescription)"
                    self.isGenerating = false
                }
            }
        }
    }

    private func buildClinicianInfo(from credentials: [VerifiableCredential]) -> ClinicianInfo {
        // Try to extract clinician info from credentials
        let firstCredential = credentials.first
        let claims = firstCredential?.credentialSubject.claims ?? [:]

        let name = claims["name"] ?? claims["fullName"] ?? "Clinician"
        let degree = claims["degree"] ?? claims["educationLevel"]
        let specialty = claims["specialty"] ?? claims["specialization"]

        // Get DID from app state
        let didHash = appState.currentUserDid

        return ClinicianInfo(
            id: didHash ?? UUID().uuidString,
            name: name,
            degree: degree,
            specialty: specialty,
            headlineSummary: nil,
            identityOrbColor: nil,
            didHash: didHash,
            phone: claims["phone"],
            email: claims["email"],
            city: claims["city"],
            state: claims["state"]
        )
    }

    private func calculateYearsExperience(from employment: [Employment]) -> Int {
        guard !employment.isEmpty else { return 0 }

        let calendar = Calendar.current
        var totalMonths = 0

        for job in employment {
            let endDate = job.endDate ?? Date()
            let components = calendar.dateComponents([.month], from: job.startDate, to: endDate)
            totalMonths += components.month ?? 0
        }

        return totalMonths / 12
    }
}

// MARK: - Stat Item View

private struct StatItem: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: WalletSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.walletPrimary)

            Text(value)
                .font(WalletTypography.headline)

            Text(label)
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Resume View Model

@MainActor
class ResumeViewModel: ObservableObject {
    @Published var configuration = ResumeConfiguration()
    @Published var resume: ResumeModel?

    func notifyResumeReady() {
        // Phase 5: Send notification
        // For now, placeholder
        print("Resume ready notification")
    }
}

#Preview {
    ResumeView()
        .environmentObject(AppStateContainer.shared)
}

