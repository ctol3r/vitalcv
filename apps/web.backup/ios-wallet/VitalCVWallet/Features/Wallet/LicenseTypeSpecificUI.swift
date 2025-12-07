//
//  LicenseTypeSpecificUI.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 32
//  License-type-specific UI variations
//

import SwiftUI

/// LicenseTypeSpecificUI - Provides UI variations based on license type
struct LicenseTypeSpecificUI {
    static func style(for credential: VerifiableCredential) -> LicenseStyle {
        let typeString = credential.type.joined().lowercased()
        let claimsString = credential.credentialSubject.claims.values.joined().lowercased()

        // Medical licenses
        if typeString.contains("medical") || typeString.contains("physician") || claimsString.contains("md") || claimsString.contains("do") {
            return .medical
        }

        // Nursing licenses
        if typeString.contains("nursing") || typeString.contains("rn") || claimsString.contains("nurse") {
            return .nursing
        }

        // Pharmacy licenses
        if typeString.contains("pharmacy") || typeString.contains("pharmacist") || claimsString.contains("pharmd") {
            return .pharmacy
        }

        // Dental licenses
        if typeString.contains("dental") || typeString.contains("dentist") || claimsString.contains("dds") || claimsString.contains("dmd") {
            return .dental
        }

        // Legal licenses
        if typeString.contains("legal") || typeString.contains("attorney") || claimsString.contains("bar") {
            return .legal
        }

        // Education credentials
        if typeString.contains("education") || typeString.contains("degree") || claimsString.contains("bachelor") || claimsString.contains("master") {
            return .education
        }

        // Professional certifications
        if typeString.contains("certification") || typeString.contains("certificate") {
            return .certification
        }

        // Default
        return .generic
    }
}

// MARK: - License Style

enum LicenseStyle {
    case medical
    case nursing
    case pharmacy
    case dental
    case legal
    case education
    case certification
    case generic

    var primaryColor: Color {
        switch self {
        case .medical: return Color(red: 0.2, green: 0.6, blue: 0.9) // Medical blue
        case .nursing: return Color(red: 0.9, green: 0.3, blue: 0.3) // Nursing red
        case .pharmacy: return Color(red: 0.3, green: 0.7, blue: 0.5) // Pharmacy green
        case .dental: return Color(red: 0.4, green: 0.8, blue: 0.9) // Dental cyan
        case .legal: return Color(red: 0.3, green: 0.3, blue: 0.5) // Legal navy
        case .education: return Color(red: 0.6, green: 0.4, blue: 0.8) // Education purple
        case .certification: return Color(red: 0.9, green: 0.6, blue: 0.2) // Certification gold
        case .generic: return .walletPrimary
        }
    }

    var icon: String {
        switch self {
        case .medical: return "cross.case.fill"
        case .nursing: return "heart.text.square.fill"
        case .pharmacy: return "pills.fill"
        case .dental: return "mouth.fill"
        case .legal: return "scale.3d"
        case .education: return "graduationcap.fill"
        case .certification: return "seal.fill"
        case .generic: return "doc.text.fill"
        }
    }

    var badgeText: String {
        switch self {
        case .medical: return "Medical License"
        case .nursing: return "Nursing License"
        case .pharmacy: return "Pharmacy License"
        case .dental: return "Dental License"
        case .legal: return "Legal License"
        case .education: return "Education Credential"
        case .certification: return "Certification"
        case .generic: return "Credential"
        }
    }

    var accentPattern: PatternStyle {
        switch self {
        case .medical: return .stethoscope
        case .nursing: return .heartbeat
        case .pharmacy: return .pills
        case .dental: return .tooth
        case .legal: return .scales
        case .education: return .graduation
        case .certification: return .seal
        case .generic: return .generic
        }
    }
}

enum PatternStyle {
    case stethoscope
    case heartbeat
    case pills
    case tooth
    case scales
    case graduation
    case seal
    case generic
}

// MARK: - License-Specific Card View

struct LicenseSpecificCardView: View {
    let credential: VerifiableCredential
    let style: LicenseStyle

    init(credential: VerifiableCredential) {
        self.credential = credential
        self.style = LicenseTypeSpecificUI.style(for: credential)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Header with style-specific design
            HStack {
                ZStack {
                    Circle()
                        .fill(style.primaryColor.opacity(0.2))
                        .frame(width: 60, height: 60)

                    Image(systemName: style.icon)
                        .font(.system(size: 30))
                        .foregroundColor(style.primaryColor)
                }

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(style.badgeText)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text(credential.type.first ?? "Credential")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()
            }

            // Style-specific pattern overlay
            LicensePatternOverlay(style: style.accentPattern, color: style.primaryColor)
                .frame(height: 4)
                .opacity(0.6)

            // Credential details with style-specific colors
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                ForEach(Array(credential.credentialSubject.claims.prefix(3)), id: \.key) { key, value in
                    HStack {
                        Text(key.capitalized)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)

                        Spacer()

                        Text(value)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(style.primaryColor)
                            .bold()
                    }
                }
            }
        }
        .padding(WalletSpacing.lg)
        .background(
            LinearGradient(
                colors: [
                    style.primaryColor.opacity(0.05),
                    Color.walletCard
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(WalletCornerRadius.large)
        .overlay(
            RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                .stroke(style.primaryColor.opacity(0.3), lineWidth: 2)
        )
        .walletShadow(WalletShadow.medium)
    }
}

// MARK: - License Pattern Overlay

struct LicensePatternOverlay: View {
    let style: PatternStyle
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                switch style {
                case .stethoscope:
                    drawStethoscopePattern(path: &path, in: geometry.size)
                case .heartbeat:
                    drawHeartbeatPattern(path: &path, in: geometry.size)
                case .pills:
                    drawPillsPattern(path: &path, in: geometry.size)
                case .tooth:
                    drawToothPattern(path: &path, in: geometry.size)
                case .scales:
                    drawScalesPattern(path: &path, in: geometry.size)
                case .graduation:
                    drawGraduationPattern(path: &path, in: geometry.size)
                case .seal:
                    drawSealPattern(path: &path, in: geometry.size)
                case .generic:
                    drawGenericPattern(path: &path, in: geometry.size)
                }
            }
            .stroke(color, lineWidth: 2)
        }
    }

    private func drawStethoscopePattern(path: inout Path, in size: CGSize) {
        // Simple wave pattern
        path.move(to: CGPoint(x: 0, y: size.height / 2))
        for x in stride(from: 0, through: size.width, by: 10) {
            let y = size.height / 2 + sin(x / 20) * 2
            path.addLine(to: CGPoint(x: x, y: y))
        }
    }

    private func drawHeartbeatPattern(path: inout Path, in size: CGSize) {
        path.move(to: CGPoint(x: 0, y: size.height))
        path.addLine(to: CGPoint(x: size.width * 0.3, y: 0))
        path.addLine(to: CGPoint(x: size.width * 0.4, y: size.height * 0.5))
        path.addLine(to: CGPoint(x: size.width * 0.6, y: size.height * 0.5))
        path.addLine(to: CGPoint(x: size.width * 0.7, y: 0))
        path.addLine(to: CGPoint(x: size.width, y: size.height))
    }

    private func drawPillsPattern(path: inout Path, in size: CGSize) {
        for x in stride(from: 0, to: size.width, by: 20) {
            path.addEllipse(in: CGRect(x: x, y: 0, width: 8, height: size.height))
        }
    }

    private func drawToothPattern(path: inout Path, in size: CGSize) {
        // Simple zigzag
        path.move(to: CGPoint(x: 0, y: size.height / 2))
        for x in stride(from: 0, through: size.width, by: 10) {
            let y = (x / 10) % 2 == 0 ? 0 : size.height
            path.addLine(to: CGPoint(x: x, y: y))
        }
    }

    private func drawScalesPattern(path: inout Path, in size: CGSize) {
        // Balance scales pattern
        let centerX = size.width / 2
        path.move(to: CGPoint(x: centerX, y: 0))
        path.addLine(to: CGPoint(x: centerX, y: size.height))
        path.addLine(to: CGPoint(x: 0, y: size.height / 2))
        path.move(to: CGPoint(x: centerX, y: size.height / 2))
        path.addLine(to: CGPoint(x: size.width, y: size.height / 2))
    }

    private func drawGraduationPattern(path: inout Path, in size: CGSize) {
        // Graduation cap pattern
        for x in stride(from: 0, to: size.width, by: 15) {
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x + 10, y: size.height))
        }
    }

    private func drawSealPattern(path: inout Path, in size: CGSize) {
        // Circular seal pattern
        let centerX = size.width / 2
        path.addEllipse(in: CGRect(x: centerX - 2, y: 0, width: 4, height: size.height))
    }

    private func drawGenericPattern(path: inout Path, in size: CGSize) {
        // Simple line
        path.move(to: CGPoint(x: 0, y: size.height / 2))
        path.addLine(to: CGPoint(x: size.width, y: size.height / 2))
    }
}

#Preview {
    LicenseSpecificCardView(
        credential: VerifiableCredential(
            id: "test",
            type: ["MedicalLicense"],
            issuer: Issuer(id: "did:test", name: "Medical Board", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(
                id: "did:test:subject",
                type: nil,
                claims: ["license_number": "MD-12345"]
            ),
            proof: nil,
            evidence: nil,
            chainAnchorId: nil
        )
    )
    .padding()
}








