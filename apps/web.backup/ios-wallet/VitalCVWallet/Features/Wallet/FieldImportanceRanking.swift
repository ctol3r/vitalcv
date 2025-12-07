//
//  FieldImportanceRanking.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 31
//  Field importance ranking for credential details
//

import SwiftUI

/// FieldImportanceRanking - Ranks credential fields by importance
struct FieldImportanceRanking {
    static func rankFields(for credential: VerifiableCredential) -> [RankedField] {
        var rankedFields: [RankedField] = []

        // Extract fields from credential subject
        let claims = credential.credentialSubject.claims

        for (key, value) in claims {
            let importance = calculateImportance(key: key, value: value, credential: credential)
            rankedFields.append(RankedField(
                key: key,
                value: value,
                importance: importance,
                category: categorizeField(key)
            ))
        }

        // Sort by importance (highest first)
        return rankedFields.sorted { $0.importance.score > $1.importance.score }
    }

    /// Calculate importance score for a field
    private static func calculateImportance(
        key: String,
        value: String,
        credential: VerifiableCredential
    ) -> Importance {
        let keyLower = key.lowercased()

        // High importance fields
        if keyLower.contains("name") || keyLower.contains("title") {
            return Importance(score: 1.0, level: .critical)
        }

        if keyLower.contains("license") || keyLower.contains("certification") {
            return Importance(score: 0.95, level: .critical)
        }

        if keyLower.contains("npi") || keyLower.contains("id") {
            return Importance(score: 0.9, level: .critical)
        }

        if keyLower.contains("expiration") || keyLower.contains("expiry") {
            return Importance(score: 0.85, level: .high)
        }

        if keyLower.contains("issuance") || keyLower.contains("issued") {
            return Importance(score: 0.8, level: .high)
        }

        if keyLower.contains("specialty") || keyLower.contains("specialization") {
            return Importance(score: 0.75, level: .high)
        }

        if keyLower.contains("organization") || keyLower.contains("institution") {
            return Importance(score: 0.7, level: .medium)
        }

        if keyLower.contains("address") || keyLower.contains("location") {
            return Importance(score: 0.6, level: .medium)
        }

        if keyLower.contains("email") || keyLower.contains("phone") {
            return Importance(score: 0.5, level: .medium)
        }

        // Default: low importance
        return Importance(score: 0.3, level: .low)
    }

    /// Categorize field by type
    private static func categorizeField(_ key: String) -> FieldCategory {
        let keyLower = key.lowercased()

        if keyLower.contains("license") || keyLower.contains("certification") {
            return .credential
        }

        if keyLower.contains("name") || keyLower.contains("title") {
            return .identity
        }

        if keyLower.contains("expiration") || keyLower.contains("issuance") {
            return .temporal
        }

        if keyLower.contains("address") || keyLower.contains("location") {
            return .location
        }

        if keyLower.contains("contact") || keyLower.contains("email") || keyLower.contains("phone") {
            return .contact
        }

        return .other
    }
}

// MARK: - Ranked Field

struct RankedField: Identifiable {
    let id = UUID()
    let key: String
    let value: String
    let importance: Importance
    let category: FieldCategory

    var displayKey: String {
        key.capitalized.replacingOccurrences(of: "_", with: " ")
    }
}

// MARK: - Importance

struct Importance {
    let score: Double // 0.0 to 1.0
    let level: ImportanceLevel

    var color: Color {
        switch level {
        case .critical: return .walletError
        case .high: return .walletWarning
        case .medium: return .walletInfo
        case .low: return .walletTextSecondary
        }
    }

    var icon: String {
        switch level {
        case .critical: return "exclamationmark.triangle.fill"
        case .high: return "star.fill"
        case .medium: return "circle.fill"
        case .low: return "circle"
        }
    }
}

enum ImportanceLevel {
    case critical
    case high
    case medium
    case low
}

enum FieldCategory {
    case identity
    case credential
    case temporal
    case location
    case contact
    case other

    var icon: String {
        switch self {
        case .identity: return "person.fill"
        case .credential: return "seal.fill"
        case .temporal: return "calendar"
        case .location: return "location.fill"
        case .contact: return "envelope.fill"
        case .other: return "doc.text"
        }
    }

    var color: Color {
        switch self {
        case .identity: return .walletPrimary
        case .credential: return .walletSuccess
        case .temporal: return .walletWarning
        case .location: return .walletInfo
        case .contact: return .walletAccent
        case .other: return .walletTextSecondary
        }
    }
}

// MARK: - Ranked Field View

struct RankedFieldView: View {
    let field: RankedField

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            // Importance indicator
            ZStack {
                Circle()
                    .fill(field.importance.color.opacity(0.2))
                    .frame(width: 40, height: 40)

                Image(systemName: field.importance.icon)
                    .foregroundColor(field.importance.color)
                    .font(.system(size: 16))
            }

            // Field info
            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                HStack {
                    Text(field.displayKey)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Spacer()

                    // Importance badge
                    Text(field.importance.level.rawValue.capitalized)
                        .font(WalletTypography.caption)
                        .foregroundColor(field.importance.color)
                        .padding(.horizontal, WalletSpacing.xs)
                        .padding(.vertical, 2)
                        .background(field.importance.color.opacity(0.1))
                        .cornerRadius(4)
                }

                Text(field.value)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }
}

extension ImportanceLevel {
    var rawValue: String {
        switch self {
        case .critical: return "critical"
        case .high: return "high"
        case .medium: return "medium"
        case .low: return "low"
        }
    }
}

#Preview {
    VStack {
        RankedFieldView(
            field: RankedField(
                key: "license_number",
                value: "MD-12345",
                importance: Importance(score: 0.95, level: .critical),
                category: .credential
            )
        )
    }
    .padding()
}








