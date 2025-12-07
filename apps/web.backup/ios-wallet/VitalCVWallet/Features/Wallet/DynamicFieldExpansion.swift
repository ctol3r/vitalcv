//
//  DynamicFieldExpansion.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 34
//  Dynamic field expansion based on trust
//

import SwiftUI

/// DynamicFieldExpansion - Expands fields based on trust score
struct DynamicFieldExpansion: View {
    let credential: VerifiableCredential
    let trustScore: Double

    @State private var expandedFields: Set<String> = []

    private var rankedFields: [RankedField] {
        FieldImportanceRanking.rankFields(for: credential)
    }

    private var visibleFields: [RankedField] {
        // Show more fields as trust increases
        let threshold = trustScore
        let maxFields = Int(threshold * Double(rankedFields.count)) + 3 // Minimum 3 fields

        return Array(rankedFields.prefix(maxFields))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Trust-based header
            HStack {
                Text("Credential Fields")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                Spacer()

                // Trust indicator
                HStack(spacing: WalletSpacing.xs) {
                    Image(systemName: "shield.checkmark.fill")
                        .foregroundColor(trustColor)
                        .font(.caption)

                    Text("\(Int(trustScore * 100))% trust")
                        .font(WalletTypography.caption)
                        .foregroundColor(trustColor)
                }
                .padding(.horizontal, WalletSpacing.sm)
                .padding(.vertical, WalletSpacing.xs)
                .background(trustColor.opacity(0.1))
                .cornerRadius(WalletCornerRadius.small)
            }

            // Fields list
            ForEach(visibleFields) { field in
                ExpandableFieldView(
                    field: field,
                    isExpanded: expandedFields.contains(field.id.uuidString),
                    trustScore: trustScore
                ) {
                    toggleExpansion(for: field)
                }
            }

            // Hidden fields indicator (if trust is low)
            if visibleFields.count < rankedFields.count {
                Button(action: {
                    // Show all fields (requires higher trust or user action)
                }) {
                    HStack {
                        Image(systemName: "eye.slash.fill")
                        Text("\(rankedFields.count - visibleFields.count) more fields hidden")
                            .font(WalletTypography.caption)
                    }
                    .foregroundColor(.walletTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(WalletSpacing.sm)
                    .background(Color.walletBackground)
                    .cornerRadius(WalletCornerRadius.small)
                }
            }
        }
    }

    private var trustColor: Color {
        if trustScore >= 0.8 {
            return .walletSuccess
        } else if trustScore >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    private func toggleExpansion(for field: RankedField) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            if expandedFields.contains(field.id.uuidString) {
                expandedFields.remove(field.id.uuidString)
            } else {
                expandedFields.insert(field.id.uuidString)
            }
        }
    }
}

// MARK: - Expandable Field View

struct ExpandableFieldView: View {
    let field: RankedField
    let isExpanded: Bool
    let trustScore: Double
    let action: () -> Void

    private var canExpand: Bool {
        // Higher trust = can expand more fields
        // Critical fields always expandable
        if field.importance.level == .critical {
            return true
        }

        // High importance fields expandable at medium trust
        if field.importance.level == .high && trustScore >= 0.5 {
            return true
        }

        // Medium importance fields expandable at high trust
        if field.importance.level == .medium && trustScore >= 0.7 {
            return true
        }

        // Low importance fields expandable at very high trust
        if field.importance.level == .low && trustScore >= 0.9 {
            return true
        }

        return false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Field header
            Button(action: action) {
                HStack {
                    // Importance indicator
                    ZStack {
                        Circle()
                            .fill(field.importance.color.opacity(0.2))
                            .frame(width: 32, height: 32)

                        Image(systemName: field.importance.icon)
                            .foregroundColor(field.importance.color)
                            .font(.system(size: 14))
                    }

                    // Field name
                    VStack(alignment: .leading, spacing: 2) {
                        Text(field.displayKey)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletText)

                        if !canExpand {
                            Text("Requires higher trust to expand")
                                .font(WalletTypography.caption2)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }

                    Spacer()

                    // Expand indicator
                    if canExpand {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .foregroundColor(.walletTextSecondary)
                            .font(.caption)
                    } else {
                        Image(systemName: "lock.fill")
                            .foregroundColor(.walletTextSecondary.opacity(0.5))
                            .font(.caption)
                    }
                }
                .padding(WalletSpacing.sm)
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())
            .disabled(!canExpand)

            // Expanded content
            if isExpanded && canExpand {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Divider()

                    // Field value
                    Text(field.value)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletText)
                        .padding(.horizontal, WalletSpacing.sm)

                    // Field metadata
                    HStack {
                        Label(field.category.rawValue.capitalized, systemImage: field.category.icon)
                            .font(WalletTypography.caption)
                            .foregroundColor(field.category.color)

                        Spacer()

                        Text("\(Int(field.importance.score * 100))% importance")
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                    .padding(.horizontal, WalletSpacing.sm)
                    .padding(.bottom, WalletSpacing.sm)
                }
                .background(Color.walletBackground)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }
}

extension FieldCategory {
    var rawValue: String {
        switch self {
        case .identity: return "identity"
        case .credential: return "credential"
        case .temporal: return "temporal"
        case .location: return "location"
        case .contact: return "contact"
        case .other: return "other"
        }
    }
}

#Preview {
    DynamicFieldExpansion(
        credential: VerifiableCredential(
            id: "test",
            type: ["TestCredential"],
            issuer: Issuer(id: "did:test", name: "Test", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(
                id: "did:test:subject",
                type: nil,
                claims: [
                    "name": "John Doe",
                    "license_number": "MD-12345",
                    "email": "john@example.com"
                ]
            ),
            proof: nil,
            evidence: nil,
            chainAnchorId: nil
        ),
        trustScore: 0.75
    )
    .padding()
}








