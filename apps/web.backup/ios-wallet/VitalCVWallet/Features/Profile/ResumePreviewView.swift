//
//  ResumePreviewView.swift
//  VitalCVWallet
//
//  Created: Smart Resume Generator - Phase 2
//  SwiftUI Resume UI Preview - user sees their résumé before exporting
//

import SwiftUI

/// ResumePreviewView - Preview the résumé before exporting or sharing
struct ResumePreviewView: View {
    let resume: ResumeModel
    let configuration: ResumeConfiguration
    @Environment(\.dismiss) var dismiss
    @State private var showingCustomization = false
    @State private var showingExportOptions = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 0) {
                    // Top Banner (Task 10)
                    topBanner

                    // Verified Credentials Section (Task 11)
                    verifiedCredentialsSection

                    // Employment Timeline (Task 12)
                    employmentTimelineSection

                    // Education History (Task 13)
                    educationHistorySection

                    // Endorsements & References (Task 14)
                    endorsementsReferencesSection

                    // Trust Badge (Task 15)
                    trustBadgeSection
                }
            }
            .navigationTitle("Resume Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(action: {
                            showingCustomization = true
                        }) {
                            Label("Customize", systemImage: "slider.horizontal.3")
                        }

                        Button(action: {
                            showingExportOptions = true
                        }) {
                            Label("Export", systemImage: "square.and.arrow.up")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showingCustomization) {
                ResumeCustomizationView(
                    resume: resume,
                    configuration: .constant(configuration),
                    onUpdate: { _ in }
                )
            }
            .sheet(isPresented: $showingExportOptions) {
                ResumeExportOptionsView(resume: resume, configuration: configuration)
            }
        }
    }

    // MARK: - Top Banner (Task 10)

    private var topBanner: some View {
        VStack(spacing: WalletSpacing.md) {
            // Identity Orb with Glow
            ZStack {
                Circle()
                    .fill(orbColor)
                    .frame(width: 80, height: 80)
                    .shadow(color: orbColor.opacity(0.5), radius: 20, x: 0, y: 0)

                Text(initials)
                    .font(WalletTypography.title1)
                    .foregroundColor(.white)
            }
            .padding(.top, WalletSpacing.lg)

            // Clinician Name
            Text(resume.name)
                .font(WalletTypography.largeTitle)
                .fontWeight(.bold)

            // Specialty
            if let specialty = resume.specialty {
                Text(specialty)
                    .font(WalletTypography.title3)
                    .foregroundColor(.walletTextSecondary)
            }

            // Years Practiced
            let yearsPracticed = calculateYearsPracticed()
            if yearsPracticed > 0 {
                Text("\(yearsPracticed) years of practice")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
            }

            // Headline Summary
            if let headline = resume.headlineSummary {
                Text(headline)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)
                    .padding(.top, WalletSpacing.xs)
            }

            // Contact Info (if enabled)
            if configuration.showContactInfo {
                contactInfoView
            }
        }
        .frame(maxWidth: .infinity)
        .padding(WalletSpacing.xl)
        .background(
            LinearGradient(
                colors: [orbColor.opacity(0.1), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private var contactInfoView: some View {
        VStack(spacing: WalletSpacing.xs) {
            if let email = resume.email, configuration.showEmail {
                HStack(spacing: WalletSpacing.xs) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 12))
                    Text(email)
                        .font(WalletTypography.caption)
                }
                .foregroundColor(.walletTextSecondary)
            }

            if let phone = resume.phone, configuration.showPhone {
                HStack(spacing: WalletSpacing.xs) {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 12))
                    Text(phone)
                        .font(WalletTypography.caption)
                }
                .foregroundColor(.walletTextSecondary)
            }

            if let city = resume.city, configuration.showCity {
                HStack(spacing: WalletSpacing.xs) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 12))
                    Text(city + (resume.state != nil ? ", \(resume.state!)" : ""))
                        .font(WalletTypography.caption)
                }
                .foregroundColor(.walletTextSecondary)
            }
        }
        .padding(.top, WalletSpacing.sm)
    }

    private var orbColor: Color {
        if let colorString = resume.identityOrbColor,
           let color = Color(hex: colorString) {
            return color
        }
        return Color.walletPrimary
    }

    private var initials: String {
        let components = resume.name.components(separatedBy: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1)) + String(components[1].prefix(1))
        } else if !components.isEmpty {
            return String(components[0].prefix(2))
        }
        return "CV"
    }

    private func calculateYearsPracticed() -> Int {
        guard !resume.employment.isEmpty else { return 0 }

        let earliestStart = resume.employment.map { $0.startDate }.min() ?? Date()
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year], from: earliestStart, to: Date())
        return components.year ?? 0
    }

    // MARK: - Verified Credentials Section (Task 11)

    private var verifiedCredentialsSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            SectionHeader(title: "Verified Credentials", icon: "checkmark.shield.fill")

            // Licensure
            if !resume.licensure.isEmpty {
                CredentialGroupView(
                    title: "Licensure",
                    credentials: resume.licensure.map { license in
                        CredentialItem(
                            title: "\(license.type) - \(license.state)",
                            subtitle: license.number,
                            status: license.isActive ? "Active" : license.status,
                            isAnchored: license.chainAnchored
                        )
                    }
                )
            }

            // Board Certifications
            if !resume.boardCertifications.isEmpty {
                CredentialGroupView(
                    title: "Board Certifications",
                    credentials: resume.boardCertifications.map { cert in
                        CredentialItem(
                            title: cert.certificationName,
                            subtitle: "\(cert.boardName) - \(cert.specialty)",
                            status: cert.isActive ? "Active" : cert.status,
                            isAnchored: cert.chainAnchored
                        )
                    }
                )
            }

            // DEA/MATE
            if !resume.deaMate.isEmpty {
                CredentialGroupView(
                    title: "DEA/MATE",
                    credentials: resume.deaMate.map { dea in
                        CredentialItem(
                            title: dea.type,
                            subtitle: dea.number,
                            status: dea.isActive ? "Active" : dea.status,
                            isAnchored: dea.chainAnchored
                        )
                    }
                )
            }

            // Additional Certifications
            if !resume.certifications.isEmpty {
                CredentialGroupView(
                    title: "Certifications",
                    credentials: resume.certifications.map { cert in
                        CredentialItem(
                            title: cert.name,
                            subtitle: cert.issuer,
                            status: cert.isActive ? "Active" : "Expired",
                            isAnchored: cert.chainAnchored
                        )
                    }
                )
            }
        }
        .padding(WalletSpacing.lg)
    }

    // MARK: - Employment Timeline (Task 12)

    private var employmentTimelineSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            SectionHeader(title: "Professional Experience", icon: "briefcase.fill")

            if resume.employment.isEmpty {
                Text("No employment history available")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .italic()
            } else {
                ForEach(resume.employment) { employment in
                    EmploymentItemView(employment: employment)
                }
            }
        }
        .padding(WalletSpacing.lg)
    }

    // MARK: - Education History (Task 13)

    private var educationHistorySection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            SectionHeader(title: "Education", icon: "graduationcap.fill")

            if resume.education.isEmpty {
                Text("No education history available")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .italic()
            } else {
                ForEach(resume.education) { education in
                    EducationItemView(education: education)
                }
            }
        }
        .padding(WalletSpacing.lg)
    }

    // MARK: - Endorsements & References (Task 14)

    private var endorsementsReferencesSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.lg) {
            // Endorsements
            if !resume.endorsements.isEmpty {
                VStack(alignment: .leading, spacing: WalletSpacing.md) {
                    SectionHeader(title: "Endorsements", icon: "star.fill")

                    ForEach(resume.endorsements) { endorsement in
                        EndorsementItemView(endorsement: endorsement)
                    }
                }
            }

            // References
            if !resume.verifiedReferences.isEmpty {
                VStack(alignment: .leading, spacing: WalletSpacing.md) {
                    SectionHeader(title: "Professional References", icon: "person.2.fill")

                    ForEach(resume.verifiedReferences) { reference in
                        ReferenceItemView(reference: reference)
                    }
                }
            }
        }
        .padding(WalletSpacing.lg)
    }

    // MARK: - Trust Badge (Task 15)

    private var trustBadgeSection: some View {
        VStack(spacing: WalletSpacing.md) {
            TrustBadgeView(
                trustScore: resume.trustScore,
                anchorIntegrity: resume.anchorIntegritySummary
            )
        }
        .padding(WalletSpacing.lg)
    }
}

// MARK: - Supporting Views

private struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            Image(systemName: icon)
                .foregroundColor(.walletPrimary)
            Text(title)
                .font(WalletTypography.title3)
        }
    }
}

private struct CredentialItem {
    let title: String
    let subtitle: String
    let status: String
    let isAnchored: Bool
}

private struct CredentialGroupView: View {
    let title: String
    let credentials: [CredentialItem]

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text(title)
                .font(WalletTypography.headline)
                .foregroundColor(.walletTextSecondary)

            ForEach(Array(credentials.enumerated()), id: \.offset) { _, credential in
                HStack {
                    VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                        Text(credential.title)
                            .font(WalletTypography.subheadline)
                        Text(credential.subtitle)
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: WalletSpacing.xs) {
                        Text(credential.status)
                            .font(WalletTypography.caption)
                            .foregroundColor(credential.status == "Active" ? .walletSuccess : .walletTextSecondary)

                        if credential.isAnchored {
                            HStack(spacing: 2) {
                                Image(systemName: "link")
                                    .font(.system(size: 8))
                                Text("Anchored")
                                    .font(.system(size: 8))
                            }
                            .foregroundColor(.walletPrimary)
                        }
                    }
                }
                .padding(.vertical, WalletSpacing.xs)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

private struct EmploymentItemView: View {
    let employment: Employment

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            HStack {
                Text(employment.title)
                    .font(WalletTypography.headline)
                Spacer()
                Text(dateRange)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Text(employment.organization)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletPrimary)

            if let location = employment.location {
                Text(location)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            if let description = employment.description {
                Text(description)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .padding(.top, WalletSpacing.xs)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }

    private var dateRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        let start = formatter.string(from: employment.startDate)
        let end = employment.endDate.map { formatter.string(from: $0) } ?? "Present"
        return "\(start) - \(end)"
    }
}

private struct EducationItemView: View {
    let education: Education

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text(education.degree)
                .font(WalletTypography.headline)

            Text(education.institution)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletPrimary)

            if let field = education.field {
                Text(field)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            if let year = education.yearGraduated {
                Text("\(year)")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

private struct EndorsementItemView: View {
    let endorsement: Endorsement

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text("\"\(endorsement.content)\"")
                .font(WalletTypography.body)
                .italic()

            HStack {
                Text(endorsement.endorserName)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletPrimary)

                if let title = endorsement.endorserTitle {
                    Text("• \(title)")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            if let org = endorsement.endorserOrganization {
                Text(org)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

private struct ReferenceItemView: View {
    let reference: Reference

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text(reference.name)
                .font(WalletTypography.headline)

            Text(reference.title)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletPrimary)

            Text(reference.organization)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)

            Text(reference.relationship)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

private struct TrustBadgeView: View {
    let trustScore: Double
    let anchorIntegrity: AnchorIntegritySummary

    var body: some View {
        VStack(spacing: WalletSpacing.md) {
            HStack {
                Image(systemName: "shield.checkered")
                    .font(.system(size: 24))
                    .foregroundColor(.walletPrimary)

                Text("Chain Anchored Credential Portfolio")
                    .font(WalletTypography.headline)
            }

            HStack(spacing: WalletSpacing.xl) {
                VStack {
                    Text("\(Int(trustScore))")
                        .font(WalletTypography.title1)
                        .foregroundColor(.walletPrimary)
                    Text("Trust Score")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }

                VStack {
                    Text("\(Int(anchorIntegrity.anchoredPercentage))%")
                        .font(WalletTypography.title1)
                        .foregroundColor(.walletPrimary)
                    Text("Anchored")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(WalletSpacing.lg)
        .background(
            LinearGradient(
                colors: [Color.walletPrimary.opacity(0.1), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .cornerRadius(WalletCornerRadius.large)
    }
}

// MARK: - Extensions

extension Color {
    init?(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            return nil
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Configuration Extension

extension ResumeConfiguration {
    var showContactInfo: Bool {
        // Logic for showing contact info based on disclosure rules
        return true // Simplified for now
    }

    var showEmail: Bool {
        return true
    }

    var showPhone: Bool {
        return true
    }

    var showCity: Bool {
        return true
    }
}

// Note: ResumeCustomizationView and ResumeExportOptionsView are defined in separate files

#Preview {
    ResumePreviewView(
        resume: ResumeModel(
            clinicianId: "test",
            name: "Dr. Jane Smith",
            degree: "MD",
            specialty: "Emergency Medicine",
            headlineSummary: "Board-certified emergency physician with 10 years of experience",
            licensure: [],
            employment: [],
            education: []
        ),
        configuration: ResumeConfiguration()
    )
}

