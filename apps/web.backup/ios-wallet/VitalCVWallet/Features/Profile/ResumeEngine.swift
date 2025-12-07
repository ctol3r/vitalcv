//
//  ResumeEngine.swift
//  VitalCVWallet
//
//  Created: Smart Resume Generator - Phase 1
//  Core engine that builds unified résumé from credentials
//

import Foundation

/// ResumeEngine - Builds unified résumé struct from credentials
@MainActor
class ResumeEngine: ObservableObject {

    // MARK: - Public API

    /// Generate a resume from available credentials
    func generateResume(
        from credentials: [VerifiableCredential],
        clinicianInfo: ClinicianInfo,
        configuration: ResumeConfiguration = ResumeConfiguration()
    ) -> ResumeModel {

        // Extract credentials by type
        let licensure = extractLicensure(from: credentials)
        let boardCerts = extractBoardCertifications(from: credentials)
        let deaMate = extractDEAMATE(from: credentials)
        let employment = extractEmployment(from: credentials)
        let education = extractEducation(from: credentials)
        let certifications = extractCertifications(from: credentials)

        // Calculate trust score and anchor integrity
        let trustScore = calculateTrustScore(from: credentials)
        let anchorIntegrity = calculateAnchorIntegrity(from: credentials)

        // Extract endorsements and references (if available in credentials)
        let endorsements = extractEndorsements(from: credentials)
        let references = extractReferences(from: credentials)

        // Build headline summary if not provided
        let headlineSummary = clinicianInfo.headlineSummary ?? generateHeadlineSummary(
            specialty: clinicianInfo.specialty,
            yearsExperience: calculateYearsExperience(from: employment),
            boardCerts: boardCerts
        )

        // Build resume model
        var resume = ResumeModel(
            clinicianId: clinicianInfo.id,
            name: clinicianInfo.name,
            degree: clinicianInfo.degree,
            specialty: clinicianInfo.specialty,
            headlineSummary: headlineSummary,
            identityOrbColor: clinicianInfo.identityOrbColor,
            didHash: clinicianInfo.didHash,
            phone: clinicianInfo.phone,
            email: clinicianInfo.email,
            city: clinicianInfo.city,
            state: clinicianInfo.state,
            licensure: licensure,
            boardCertifications: boardCerts,
            deaMate: deaMate,
            employment: employment,
            education: education,
            certifications: certifications,
            endorsements: endorsements,
            verifiedReferences: references,
            trustScore: trustScore,
            anchorIntegritySummary: anchorIntegrity
        )

        // Apply selective disclosure rules based on configuration
        resume.disclosureRules = buildDisclosureRules(
            for: configuration,
            resumeType: .standard
        )

        return resume
    }

    // MARK: - Credential Extraction

    private func extractLicensure(from credentials: [VerifiableCredential]) -> [LicenseCredential] {
        return credentials.compactMap { credential in
            guard credential.type.contains("License") ||
                  credential.type.contains("Licensure") else {
                return nil
            }

            let claims = credential.credentialSubject.claims

            guard let type = claims["licenseType"] ?? claims["type"],
                  let state = claims["state"] ?? claims["jurisdiction"],
                  let number = claims["licenseNumber"] ?? claims["number"] else {
                return nil
            }

            let issuedDate = credential.issuanceDate
            let expirationDate = credential.expirationDate
            let status = credential.isExpired ? "Expired" : "Active"

            return LicenseCredential(
                id: credential.id,
                type: type,
                state: state,
                number: number,
                issuedDate: issuedDate,
                expirationDate: expirationDate,
                status: status,
                issuer: credential.issuer.name ?? credential.issuer.id,
                credentialId: credential.id,
                chainAnchored: credential.chainAnchorId != nil
            )
        }
    }

    private func extractBoardCertifications(from credentials: [VerifiableCredential]) -> [BoardCertification] {
        return credentials.compactMap { credential in
            guard credential.type.contains("BoardCertification") ||
                  credential.type.contains("BoardCert") ||
                  credential.type.contains("Certification") else {
                return nil
            }

            let claims = credential.credentialSubject.claims

            // Skip if it's a general certification (handled separately)
            if claims["category"] == "General" || claims["boardName"] == nil {
                return nil
            }

            guard let boardName = claims["boardName"] ?? claims["issuer"],
                  let specialty = claims["specialty"] ?? claims["field"],
                  let certificationName = claims["certificationName"] ?? claims["name"] else {
                return nil
            }

            return BoardCertification(
                id: credential.id,
                boardName: boardName,
                specialty: specialty,
                certificationName: certificationName,
                issuedDate: credential.issuanceDate,
                expirationDate: credential.expirationDate,
                status: credential.isExpired ? "Expired" : "Active",
                credentialId: credential.id,
                chainAnchored: credential.chainAnchorId != nil
            )
        }
    }

    private func extractDEAMATE(from credentials: [VerifiableCredential]) -> [DEAMATE] {
        return credentials.compactMap { credential in
            let claims = credential.credentialSubject.claims

            guard let type = claims["type"],
                  (type.contains("DEA") || type.contains("MATE")) else {
                return nil
            }

            guard let number = claims["number"] ?? claims["certificationNumber"] else {
                return nil
            }

            return DEAMATE(
                id: credential.id,
                type: type.contains("DEA") ? "DEA" : "MATE",
                number: number,
                issuedDate: credential.issuanceDate,
                expirationDate: credential.expirationDate,
                status: credential.isExpired ? "Expired" : "Active",
                credentialId: credential.id,
                chainAnchored: credential.chainAnchorId != nil
            )
        }
    }

    private func extractEmployment(from credentials: [VerifiableCredential]) -> [Employment] {
        return credentials.compactMap { credential in
            guard credential.type.contains("Employment") ||
                  credential.type.contains("WorkExperience") ||
                  credential.type.contains("Position") else {
                return nil
            }

            let claims = credential.credentialSubject.claims

            guard let organization = claims["organization"] ?? claims["employer"],
                  let title = claims["title"] ?? claims["position"] else {
                return nil
            }

            let startDate = credential.issuanceDate
            let endDate = credential.expirationDate
            let isCurrent = endDate == nil || endDate! > Date()

            return Employment(
                id: credential.id,
                organization: organization,
                title: title,
                location: claims["location"] ?? claims["city"],
                startDate: startDate,
                endDate: endDate,
                isCurrent: isCurrent,
                description: claims["description"],
                credentialId: credential.id
            )
        }.sorted { $0.startDate > $1.startDate } // Most recent first
    }

    private func extractEducation(from credentials: [VerifiableCredential]) -> [Education] {
        return credentials.compactMap { credential in
            guard credential.type.contains("Education") ||
                  credential.type.contains("Degree") ||
                  credential.type.contains("Diploma") else {
                return nil
            }

            let claims = credential.credentialSubject.claims

            guard let institution = claims["institution"] ?? claims["school"] ?? claims["university"],
                  let degree = claims["degree"] ?? claims["degreeType"] else {
                return nil
            }

            // Parse graduation date
            var graduationDate: Date? = credential.issuanceDate
            if let gradDateString = claims["graduationDate"] {
                let formatter = ISO8601DateFormatter()
                graduationDate = formatter.date(from: gradDateString) ?? credential.issuanceDate
            }

            return Education(
                id: credential.id,
                institution: institution,
                degree: degree,
                field: claims["field"] ?? claims["major"],
                graduationDate: graduationDate,
                credentialId: credential.id
            )
        }.sorted { ($0.graduationDate ?? Date.distantPast) > ($1.graduationDate ?? Date.distantPast) }
    }

    private func extractCertifications(from credentials: [VerifiableCredential]) -> [Certification] {
        return credentials.compactMap { credential in
            // Skip if already categorized
            if credential.type.contains("BoardCertification") ||
               credential.type.contains("License") ||
               credential.type.contains("DEA") ||
               credential.type.contains("MATE") ||
               credential.type.contains("Education") ||
               credential.type.contains("Employment") {
                return nil
            }

            let claims = credential.credentialSubject.claims

            guard let name = claims["name"] ?? claims["certificationName"],
                  let issuer = claims["issuer"] ?? claims["issuingOrganization"] else {
                return nil
            }

            return Certification(
                id: credential.id,
                name: name,
                issuer: issuer,
                issuedDate: credential.issuanceDate,
                expirationDate: credential.expirationDate,
                credentialId: credential.id,
                chainAnchored: credential.chainAnchorId != nil
            )
        }
    }

    // MARK: - Endorsements & References

    private func extractEndorsements(from credentials: [VerifiableCredential]) -> [Endorsement] {
        return credentials.compactMap { credential in
            guard credential.type.contains("Endorsement") ||
                  credential.type.contains("Recommendation") else {
                return nil
            }

            let claims = credential.credentialSubject.claims

            guard let endorserName = claims["endorserName"] ?? claims["name"],
                  let content = claims["content"] ?? claims["endorsement"] else {
                return nil
            }

            return Endorsement(
                id: credential.id,
                endorserName: endorserName,
                endorserTitle: claims["title"],
                endorserOrganization: claims["organization"],
                content: content,
                date: credential.issuanceDate,
                verified: credential.chainAnchorId != nil
            )
        }
    }

    private func extractReferences(from credentials: [VerifiableCredential]) -> [Reference] {
        return credentials.compactMap { credential in
            guard credential.type.contains("Reference") else {
                return nil
            }

            let claims = credential.credentialSubject.claims

            guard let name = claims["name"],
                  let title = claims["title"],
                  let organization = claims["organization"] else {
                return nil
            }

            return Reference(
                id: credential.id,
                name: name,
                title: title,
                organization: organization,
                phone: claims["phone"],
                email: claims["email"],
                relationship: claims["relationship"] ?? "Colleague",
                verified: credential.chainAnchorId != nil
            )
        }
    }

    // MARK: - Trust & Integrity Calculations

    private func calculateTrustScore(from credentials: [VerifiableCredential]) -> Double {
        guard !credentials.isEmpty else { return 0.0 }

        var score: Double = 0.0
        var totalWeight: Double = 0.0

        for credential in credentials {
            var weight: Double = 1.0

            // Higher weight for chain-anchored credentials
            if credential.chainAnchorId != nil {
                weight = 2.0
            }

            // Higher weight for non-expired credentials
            if !credential.isExpired {
                weight *= 1.5
            }

            // Base score for having proof
            var credentialScore: Double = credential.proof != nil ? 0.8 : 0.4

            // Bonus for evidence
            if let evidence = credential.evidence, !evidence.isEmpty {
                credentialScore += 0.1
            }

            score += credentialScore * weight
            totalWeight += weight
        }

        guard totalWeight > 0 else { return 0.0 }

        // Normalize to 0-100 scale
        let normalizedScore = (score / totalWeight) * 100.0
        return min(100.0, max(0.0, normalizedScore))
    }

    private func calculateAnchorIntegrity(from credentials: [VerifiableCredential]) -> AnchorIntegritySummary {
        let totalCredentials = credentials.count
        let anchoredCredentials = credentials.filter { $0.chainAnchorId != nil }
        let totalAnchored = anchoredCredentials.count

        let lastAnchoredDate = anchoredCredentials
            .compactMap { $0.chainAnchorId }
            .max() // Using anchor ID as proxy for date ordering

        let integrityScore = totalCredentials > 0
            ? Double(totalAnchored) / Double(totalCredentials) * 100.0
            : 0.0

        return AnchorIntegritySummary(
            totalAnchored: totalAnchored,
            totalCredentials: totalCredentials,
            lastAnchoredDate: nil, // Would need to extract from chainAnchorId
            chainBlockNumber: anchoredCredentials.first?.chainAnchorId,
            integrityScore: integrityScore
        )
    }

    // MARK: - Helper Methods

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

    private func generateHeadlineSummary(
        specialty: String?,
        yearsExperience: Int,
        boardCerts: [BoardCertification]
    ) -> String {
        var parts: [String] = []

        if let specialty = specialty {
            parts.append(specialty)
        }

        if yearsExperience > 0 {
            parts.append("\(yearsExperience) years of experience")
        }

        if !boardCerts.isEmpty {
            let activeCerts = boardCerts.filter { $0.isActive }
            if !activeCerts.isEmpty {
                parts.append("Board Certified")
            }
        }

        if parts.isEmpty {
            return "Experienced Healthcare Professional"
        }

        return parts.joined(separator: " • ")
    }

    private func buildDisclosureRules(
        for configuration: ResumeConfiguration,
        resumeType: DisclosureRules.ResumeType
    ) -> DisclosureRules {
        var rules = DisclosureRules()

        rules.resumeType = resumeType

        // Apply configuration-based rules
        switch resumeType {
        case .recruiter:
            rules.recruiterSafeMode = true
            rules.showDID = false
            rules.showTrustScore = false
            rules.showChainDetails = false
        case .minimal:
            rules.showPhone = false
            rules.showEmail = false
            rules.showCity = false
        default:
            break
        }

        return rules
    }
}

// MARK: - Clinician Info

/// ClinicianInfo - Information about the clinician for resume generation
struct ClinicianInfo {
    let id: String
    let name: String
    let degree: String?
    let specialty: String?
    let headlineSummary: String?
    let identityOrbColor: String?
    let didHash: String?
    let phone: String?
    let email: String?
    let city: String?
    let state: String?
}








