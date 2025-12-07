//
//  CredentialListItem.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 3
//  CredentialListItem - Flattened fields for list display
//

import Foundation

/// CredentialListItem - Flattened representation of credential for list display
/// Optimized for wallet home view performance
struct CredentialListItem: Identifiable, Hashable {
    let id: String
    let credentialId: String

    // Flattened display fields
    let title: String
    let subtitle: String
    let issuerName: String
    let issuerLogoURL: String?
    let category: CredentialCategory

    // Status fields
    let isExpired: Bool
    let isExpiringSoon: Bool
    let expirationDate: Date?
    let daysUntilExpiry: Int?

    // Trust & compliance
    let trustScore: Double?
    let anchorStatus: AnchorStatus
    let complianceBadges: [ComplianceBadge]

    // Visual indicators
    let iconName: String
    let primaryColor: String

    // Timestamps
    let issuanceDate: Date
    let lastVerifiedDate: Date?

    // Quick access
    let credential: VerifiableCredential

    enum AnchorStatus: String, Codable {
        case anchored = "anchored"
        case pending = "pending"
        case failed = "failed"
        case unknown = "unknown"
    }

    struct ComplianceBadge: Hashable {
        let type: BadgeType
        let verified: Bool

        enum BadgeType: String {
            case dea = "DEA"
            case board = "Board"
            case npdb = "NPDB"
            case licensure = "Licensure"
        }
    }

    // MARK: - Initialization

    init(from credential: VerifiableCredential, trustScore: Double? = nil, anchorStatus: AnchorStatus = .unknown) {
        self.id = credential.id
        self.credentialId = credential.id
        self.credential = credential

        // Flatten title and subtitle
        self.title = credential.type.first ?? "Credential"
        self.subtitle = credential.credentialSubject.claims["name"] ??
                       credential.credentialSubject.claims["title"] ??
                       credential.type.joined(separator: ", ")

        // Issuer info
        self.issuerName = credential.issuer.name ?? credential.issuer.id
        self.issuerLogoURL = credential.issuer.image

        // Category
        self.category = credential.category

        // Status
        self.isExpired = credential.isExpired
        self.isExpiringSoon = credential.isExpiringSoon
        self.expirationDate = credential.expirationDate

        if let expirationDate = credential.expirationDate {
            let days = Calendar.current.dateComponents([.day], from: Date(), to: expirationDate).day
            self.daysUntilExpiry = days
        } else {
            self.daysUntilExpiry = nil
        }

        // Trust & compliance
        self.trustScore = trustScore
        self.anchorStatus = anchorStatus

        // Extract compliance badges from evidence
        var badges: [ComplianceBadge] = []
        if let evidence = credential.evidence {
            for ev in evidence {
                if ev.type.lowercased().contains("dea") {
                    badges.append(ComplianceBadge(type: .dea, verified: true))
                }
                if ev.type.lowercased().contains("board") {
                    badges.append(ComplianceBadge(type: .board, verified: true))
                }
                if ev.type.lowercased().contains("npdb") {
                    badges.append(ComplianceBadge(type: .npdb, verified: true))
                }
            }
        }
        self.complianceBadges = badges

        // Visual
        self.iconName = Self.iconName(for: credential.category)
        self.primaryColor = Self.primaryColor(for: credential.category)

        // Timestamps
        self.issuanceDate = credential.issuanceDate
        self.lastVerifiedDate = nil // TODO: Extract from verification history
    }

    // MARK: - Helpers

    private static func iconName(for category: CredentialCategory) -> String {
        switch category {
        case .licenses: return "doc.text.magnifyingglass"
        case .id: return "person.text.rectangle.fill"
        case .certificates: return "seal.fill"
        case .role: return "person.badge.shield.checkmark.fill"
        case .experience: return "briefcase.fill"
        case .education: return "graduationcap.fill"
        case .other, .all: return "folder.fill"
        }
    }

    private static func primaryColor(for category: CredentialCategory) -> String {
        switch category {
        case .licenses: return "walletInfo"
        case .id: return "walletAccent"
        case .certificates: return "walletSuccess"
        case .role: return "walletWarning"
        case .experience: return "walletAccent"
        case .education: return "walletSecondary"
        case .other, .all: return "walletTextSecondary"
        }
    }
}

// MARK: - Grouping Logic

extension Array where Element == CredentialListItem {
    /// Group credentials by category: Licenses / Certs / IDs / Other
    func groupedByCategory() -> [CredentialCategory: [CredentialListItem]] {
        Dictionary(grouping: self) { $0.category }
    }

    /// Get credentials grouped and sorted by importance
    func groupedAndSorted() -> [(category: CredentialCategory, items: [CredentialListItem])] {
        let grouped = groupedByCategory()

        // Sort categories by importance
        let categoryOrder: [CredentialCategory] = [
            .licenses,
            .certificates,
            .id,
            .role,
            .experience,
            .education,
            .other
        ]

        return categoryOrder.compactMap { category in
            guard let items = grouped[category], !items.isEmpty else { return nil }
            return (category: category, items: items.sorted(by: importanceSort))
        }
    }

    /// Sort by importance: non-expired > expiring soon > expired, then by trust score
    private func importanceSort(_ a: CredentialListItem, _ b: CredentialListItem) -> Bool {
        // Non-expired first
        if !a.isExpired && b.isExpired { return true }
        if a.isExpired && !b.isExpired { return false }

        // Expiring soon next
        if a.isExpiringSoon && !b.isExpiringSoon { return true }
        if !a.isExpiringSoon && b.isExpiringSoon { return false }

        // Then by trust score (higher first)
        if let scoreA = a.trustScore, let scoreB = b.trustScore {
            return scoreA > scoreB
        }
        if a.trustScore != nil { return true }
        if b.trustScore != nil { return false }

        // Finally by issuance date (newer first)
        return a.issuanceDate > b.issuanceDate
    }
}

