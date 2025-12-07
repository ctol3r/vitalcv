//
//  CredentialCategoryFilters.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 9
//  Credential category filters (licenses, certs, experience)
//

import SwiftUI

enum CredentialCategory: String, CaseIterable, Identifiable {
    case all = "All"
    case licenses = "Licenses"
    case id = "ID"
    case certificates = "Certificates"
    case role = "Role"
    case experience = "Experience"
    case education = "Education"
    case other = "Other"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .all: return "square.grid.2x2"
        case .licenses: return "doc.text.magnifyingglass"
        case .id: return "person.text.rectangle.fill"
        case .certificates: return "seal.fill"
        case .role: return "person.badge.shield.checkmark.fill"
        case .experience: return "briefcase.fill"
        case .education: return "graduationcap.fill"
        case .other: return "folder.fill"
        }
    }

    var color: Color {
        switch self {
        case .all: return .walletPrimary
        case .licenses: return .walletInfo
        case .id: return .walletAccent
        case .certificates: return .walletSuccess
        case .role: return .walletWarning
        case .experience: return .walletAccent
        case .education: return .walletSecondary
        case .other: return .walletTextSecondary
        }
    }
}

struct CredentialCategoryFilters: View {
    @Binding var selectedCategory: CredentialCategory
    let categories: [CredentialCategory]

    init(selectedCategory: Binding<CredentialCategory>, categories: [CredentialCategory] = CredentialCategory.allCases) {
        self._selectedCategory = selectedCategory
        self.categories = categories
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: WalletSpacing.sm) {
                ForEach(categories) { category in
                    CategoryFilterChip(
                        category: category,
                        isSelected: selectedCategory == category
                    ) {
                        withAnimation(.spring()) {
                            selectedCategory = category
                        }
                        HapticFeedbackService.shared.selectionChanged()
                    }
                }
            }
            .padding(.horizontal, WalletSpacing.md)
        }
    }
}

struct CategoryFilterChip: View {
    let category: CredentialCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: WalletSpacing.xs) {
                VitalCVIcon(
                    systemName: category.icon,
                    size: 16,
                    color: isSelected ? .white : category.color
                )
                Text(category.rawValue)
                    .font(VitalCVFonts.caption1)
                    .foregroundColor(isSelected ? .white : .walletText)
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)
            .background(
                Capsule()
                    .fill(isSelected ? category.color : Color.walletCard)
            )
            .overlay(
                Capsule()
                    .stroke(category.color, lineWidth: isSelected ? 0 : 1.5)
            )
            .shadow(
                color: isSelected ? category.color.opacity(0.3) : .clear,
                radius: 4,
                x: 0,
                y: 2
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

/// Filter credentials by category
extension VerifiableCredential {
    var category: CredentialCategory {
        let typeString = type.joined().lowercased()
        let claimsString = credentialSubject.claims.values.joined().lowercased()

        if typeString.contains("license") || claimsString.contains("license") {
            return .licenses
        } else if typeString.contains("id") || typeString.contains("identity") || claimsString.contains("id") {
            return .id
        } else if typeString.contains("certificate") || typeString.contains("certification") {
            return .certificates
        } else if typeString.contains("role") || typeString.contains("position") || claimsString.contains("role") {
            return .role
        } else if typeString.contains("experience") || typeString.contains("employment") {
            return .experience
        } else if typeString.contains("education") || typeString.contains("degree") {
            return .education
        } else {
            return .other
        }
    }
}

