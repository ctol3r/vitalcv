//
//  QuickFilterTagsView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 15
//  Quick-filter tags (license, education, identity)
//

import SwiftUI

struct QuickFilterTagsView: View {
    @Binding var selectedTags: Set<CredentialTag>
    let onTagToggle: (CredentialTag) -> Void

    enum CredentialTag: String, CaseIterable, Identifiable {
        case license = "License"
        case education = "Education"
        case identity = "Identity"
        case certification = "Certification"
        case employment = "Employment"
        case all = "All"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .license: return "doc.text.fill"
            case .education: return "graduationcap.fill"
            case .identity: return "person.fill"
            case .certification: return "checkmark.seal.fill"
            case .employment: return "briefcase.fill"
            case .all: return "square.grid.2x2"
            }
        }

        var color: Color {
            switch self {
            case .license: return .blue
            case .education: return .purple
            case .identity: return .green
            case .certification: return .orange
            case .employment: return .red
            case .all: return .walletTextSecondary
            }
        }

        func matches(_ credential: VerifiableCredential) -> Bool {
            if self == .all {
                return true
            }

            let type = credential.type.first?.lowercased() ?? ""
            let claims = credential.credentialSubject.claims.values.joined().lowercased()
            let searchText = "\(type) \(claims)"

            switch self {
            case .license:
                return searchText.contains("license") || searchText.contains("permit")
            case .education:
                return searchText.contains("education") || searchText.contains("degree") ||
                       searchText.contains("university") || searchText.contains("college")
            case .identity:
                return searchText.contains("identity") || searchText.contains("passport") ||
                       searchText.contains("id") || searchText.contains("driver")
            case .certification:
                return searchText.contains("certification") || searchText.contains("certificate") ||
                       searchText.contains("certified")
            case .employment:
                return searchText.contains("employment") || searchText.contains("job") ||
                       searchText.contains("work") || searchText.contains("employer")
            case .all:
                return true
            }
        }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: WalletSpacing.sm) {
                ForEach(CredentialTag.allCases) { tag in
                    FilterTagButton(
                        tag: tag,
                        isSelected: selectedTags.contains(tag) || (tag == .all && selectedTags.isEmpty),
                        onTap: {
                            onTagToggle(tag)
                        }
                    )
                }
            }
            .padding(.horizontal, WalletSpacing.md)
        }
    }
}

// MARK: - Filter Tag Button

struct FilterTagButton: View {
    let tag: QuickFilterTagsView.CredentialTag
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: {
            HapticFeedbackService.shared.cardTapped()
            onTap()
        }) {
            HStack(spacing: WalletSpacing.xs) {
                Image(systemName: tag.icon)
                    .font(.system(size: 14))

                Text(tag.rawValue)
                    .font(WalletTypography.subheadline)
            }
            .foregroundColor(isSelected ? .white : tag.color)
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)
            .background(
                isSelected ? tag.color : tag.color.opacity(0.1)
            )
            .cornerRadius(WalletCornerRadius.large)
            .overlay(
                RoundedRectangle(cornerRadius: WalletCornerRadius.large)
                    .stroke(isSelected ? Color.clear : tag.color.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Filter Extension

extension Array where Element == VerifiableCredential {
    func filtered(by tags: Set<QuickFilterTagsView.CredentialTag>) -> [VerifiableCredential] {
        if tags.isEmpty || tags.contains(.all) {
            return self
        }

        return self.filter { credential in
            tags.contains { tag in
                tag.matches(credential)
            }
        }
    }
}








