//
//  CredentialSortingManager.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 14
//  Alphabetical and chronological sorting
//

import Foundation

enum CredentialSortOption: String, CaseIterable {
    case alphabetical = "Alphabetical"
    case chronological = "Chronological"
    case issuer = "Issuer"
    case type = "Type"
    case expiration = "Expiration"
    case favoriteFirst = "Favorite First"

    var icon: String {
        switch self {
        case .alphabetical: return "textformat.abc"
        case .chronological: return "calendar"
        case .issuer: return "person.2"
        case .type: return "tag"
        case .expiration: return "clock"
        case .favoriteFirst: return "star.fill"
        }
    }
}

struct CredentialSortingManager {
    static func sort(
        _ credentials: [VerifiableCredential],
        by option: CredentialSortOption,
        favorites: Set<String> = []
    ) -> [VerifiableCredential] {
        switch option {
        case .alphabetical:
            return credentials.sorted { credential1, credential2 in
                let name1 = credential1.type.first ?? credential1.id
                let name2 = credential2.type.first ?? credential2.id
                return name1.localizedCaseInsensitiveCompare(name2) == .orderedAscending
            }

        case .chronological:
            return credentials.sorted { credential1, credential2 in
                credential1.issuanceDate > credential2.issuanceDate
            }

        case .issuer:
            return credentials.sorted { credential1, credential2 in
                let issuer1 = credential1.issuer.name ?? credential1.issuer.id
                let issuer2 = credential2.issuer.name ?? credential2.issuer.id
                return issuer1.localizedCaseInsensitiveCompare(issuer2) == .orderedAscending
            }

        case .type:
            return credentials.sorted { credential1, credential2 in
                let type1 = credential1.type.first ?? ""
                let type2 = credential2.type.first ?? ""
                return type1.localizedCaseInsensitiveCompare(type2) == .orderedAscending
            }

        case .expiration:
            return credentials.sorted { credential1, credential2 in
                let exp1 = credential1.expirationDate ?? Date.distantFuture
                let exp2 = credential2.expirationDate ?? Date.distantFuture
                return exp1 < exp2
            }

        case .favoriteFirst:
            return credentials.sorted { credential1, credential2 in
                let fav1 = favorites.contains(credential1.id)
                let fav2 = favorites.contains(credential2.id)
                if fav1 && !fav2 {
                    return true
                } else if !fav1 && fav2 {
                    return false
                }
                // If both have same favorite status, sort by date
                return credential1.issuanceDate > credential2.issuanceDate
            }
        }
    }
}

// MARK: - Sort Picker View

struct CredentialSortPicker: View {
    @Binding var selectedSort: CredentialSortOption

    var body: some View {
        Menu {
            ForEach(CredentialSortOption.allCases, id: \.self) { option in
                Button(action: {
                    selectedSort = option
                }) {
                    HStack {
                        Image(systemName: option.icon)
                        Text(option.rawValue)
                        if selectedSort == option {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack {
                Image(systemName: selectedSort.icon)
                Text(selectedSort.rawValue)
                Image(systemName: "chevron.down")
                    .font(.caption)
            }
            .font(WalletTypography.subheadline)
            .foregroundColor(.walletText)
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
        }
    }
}








