//
//  ResumeCustomizationView.swift
//  VitalCVWallet
//
//  Created: Smart Resume Generator - Phase 3
//  Let clinicians tailor the résumé while maintaining verified content integrity
//

import SwiftUI

/// ResumeCustomizationView - Customize resume appearance and content visibility
struct ResumeCustomizationView: View {
    let resume: ResumeModel
    @Binding var configuration: ResumeConfiguration
    let onUpdate: (ResumeConfiguration) -> Void
    @Environment(\.dismiss) var dismiss

    @State private var localConfig: ResumeConfiguration
    @State private var disclosureRules: DisclosureRules

    init(
        resume: ResumeModel,
        configuration: Binding<ResumeConfiguration>,
        onUpdate: @escaping (ResumeConfiguration) -> Void
    ) {
        self.resume = resume
        self._configuration = configuration
        self.onUpdate = onUpdate
        _localConfig = State(initialValue: configuration.wrappedValue)
        _disclosureRules = State(initialValue: resume.disclosureRules)
    }

    var body: some View {
        NavigationView {
            Form {
                // Template Selection
                templateSection

                // Layout Controls (Task 19)
                layoutSection

                // Palette Controls (Task 20)
                paletteSection

                // Field Toggles (Task 18)
                fieldVisibilitySection

                // Short Resume Mode (Task 21)
                shortModeSection

                // Role Targeting (Task 22)
                roleTargetingSection

                // Watermark (Task 23)
                watermarkSection

                // Recruiter Safe Mode (Task 24)
                recruiterSafeSection
            }
            .navigationTitle("Customize Resume")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Apply") {
                        applyChanges()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }

    // MARK: - Template Section

    private var templateSection: some View {
        Section("Template Style") {
            Picker("Template", selection: $localConfig.template) {
                ForEach(ResumeTemplate.allCases) { template in
                    VStack(alignment: .leading) {
                        Text(template.rawValue)
                        Text(template.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .tag(template)
                }
            }
        }
    }

    // MARK: - Layout Controls (Task 19)

    private var layoutSection: some View {
        Section("Layout") {
            // One-column / Two-column
            Picker("Layout Type", selection: $localConfig.layout) {
                Text(ResumeConfiguration.LayoutType.singleColumn.rawValue)
                    .tag(ResumeConfiguration.LayoutType.singleColumn)
                Text(ResumeConfiguration.LayoutType.twoColumn.rawValue)
                    .tag(ResumeConfiguration.LayoutType.twoColumn)
            }

            // Compact / Expanded
            Picker("Density", selection: $localConfig.density) {
                Text(ResumeConfiguration.DensityType.compact.rawValue)
                    .tag(ResumeConfiguration.DensityType.compact)
                Text(ResumeConfiguration.DensityType.standard.rawValue)
                    .tag(ResumeConfiguration.DensityType.standard)
                Text(ResumeConfiguration.DensityType.expanded.rawValue)
                    .tag(ResumeConfiguration.DensityType.expanded)
            }
        }
    }

    // MARK: - Palette Controls (Task 20)

    private var paletteSection: some View {
        Section("Color Palette") {
            Picker("Palette", selection: $localConfig.palette) {
                Text(ResumeConfiguration.ColorPalette.neutral.rawValue)
                    .tag(ResumeConfiguration.ColorPalette.neutral)
                Text(ResumeConfiguration.ColorPalette.clinical.rawValue)
                    .tag(ResumeConfiguration.ColorPalette.clinical)
                Text(ResumeConfiguration.ColorPalette.dark.rawValue)
                    .tag(ResumeConfiguration.ColorPalette.dark)
            }
        }
    }

    // MARK: - Field Toggles (Task 18)

    private var fieldVisibilitySection: some View {
        Section("Field Visibility") {
            Toggle("Show Phone", isOn: $disclosureRules.showPhone)
            Toggle("Show Email", isOn: $disclosureRules.showEmail)
            Toggle("Show City", isOn: $disclosureRules.showCity)
            Toggle("Show DID Hash", isOn: $disclosureRules.showDID)
            Toggle("Show Trust Score", isOn: $disclosureRules.showTrustScore)
            Toggle("Show Chain Details", isOn: $disclosureRules.showChainDetails)
        }
    }

    // MARK: - Short Resume Mode (Task 21)

    private var shortModeSection: some View {
        Section("Format") {
            Toggle("Short Resume Mode (1-page auto-compress)", isOn: $localConfig.shortMode)

            if localConfig.shortMode {
                Text("Resume will be automatically compressed to fit on one page")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    // MARK: - Role Targeting (Task 22)

    private var roleTargetingSection: some View {
        Section("Role Targeting") {
            Toggle("Prioritize Relevant Credentials", isOn: $disclosureRules.prioritizeRelevantCredentials)

            if disclosureRules.prioritizeRelevantCredentials {
                TextField("Target Role (e.g., Emergency Physician)", text: Binding(
                    get: { disclosureRules.targetRole ?? "" },
                    set: { disclosureRules.targetRole = $0.isEmpty ? nil : $0 }
                ))
            }
        }
    }

    // MARK: - Watermark (Task 23)

    private var watermarkSection: some View {
        Section("Watermark") {
            Picker("Watermark", selection: $localConfig.watermark) {
                Text(ResumeConfiguration.WatermarkType.none.rawValue)
                    .tag(ResumeConfiguration.WatermarkType.none)
                Text(ResumeConfiguration.WatermarkType.vitalcv.rawValue)
                    .tag(ResumeConfiguration.WatermarkType.vitalcv)
                Text(ResumeConfiguration.WatermarkType.facility.rawValue)
                    .tag(ResumeConfiguration.WatermarkType.facility)
            }
        }
    }

    // MARK: - Recruiter Safe Mode (Task 24)

    private var recruiterSafeSection: some View {
        Section("Privacy") {
            Toggle("Recruiter-Safe Mode", isOn: $disclosureRules.recruiterSafeMode)

            if disclosureRules.recruiterSafeMode {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text("Hides unnecessary PII and sensitive information")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("• DID Hash hidden")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("• Trust Score hidden")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("• Chain details hidden")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, WalletSpacing.xs)
            }
        }
    }

    // MARK: - Actions

    private func applyChanges() {
        // Update disclosure rules based on recruiter safe mode
        if disclosureRules.recruiterSafeMode {
            disclosureRules.showDID = false
            disclosureRules.showTrustScore = false
            disclosureRules.showChainDetails = false
            disclosureRules.resumeType = .recruiter
        }

        configuration = localConfig
        onUpdate(localConfig)
        dismiss()
    }
}

#Preview {
    ResumeCustomizationView(
        resume: ResumeModel(
            clinicianId: "test",
            name: "Dr. Jane Smith",
            degree: "MD",
            specialty: "Emergency Medicine"
        ),
        configuration: .constant(ResumeConfiguration()),
        onUpdate: { _ in }
    )
}








