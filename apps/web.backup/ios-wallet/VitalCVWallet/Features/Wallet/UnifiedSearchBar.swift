//
//  UnifiedSearchBar.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 7
//  Unified search bar (credentials + roles + issuers)
//

import SwiftUI

struct UnifiedSearchBar: View {
    @Binding var searchText: String
    var placeholder: String = "Search credentials, roles, issuers..."
    var onSearch: ((String) -> Void)? = nil

    @FocusState private var isFocused: Bool
    @State private var isSearching = false

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            // Search icon
            VitalCVIcon(
                systemName: "magnifyingglass",
                size: 18,
                color: .walletTextSecondary
            )

            // Search text field
            TextField(placeholder, text: $searchText)
                .font(VitalCVFonts.body)
                .foregroundColor(.walletText)
                .focused($isFocused)
                .onChange(of: searchText) { newValue in
                    onSearch?(newValue)
                    isSearching = !newValue.isEmpty
                }
                .onSubmit {
                    onSearch?(searchText)
                }

            // Clear button
            if isSearching {
                Button(action: {
                    searchText = ""
                    isFocused = false
                }) {
                    VitalCVIcon(
                        systemName: VitalCVIcons.Navigation.close,
                        size: 16,
                        color: .walletTextSecondary
                    )
                }
            }
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
        )
        .overlay(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .stroke(isFocused ? Color.walletPrimary : Color.clear, lineWidth: 2)
        )
    }
}

/// Search results view
struct SearchResultsView: View {
    let searchText: String
    let credentials: [VerifiableCredential]
    let onCredentialTap: (VerifiableCredential) -> Void

    var filteredCredentials: [VerifiableCredential] {
        guard !searchText.isEmpty else { return [] }

        return credentials.filter { credential in
            // Search in credential type
            credential.type.joined().localizedCaseInsensitiveContains(searchText) ||
            // Search in issuer name
            (credential.issuer.name?.localizedCaseInsensitiveContains(searchText) ?? false) ||
            // Search in issuer ID
            credential.issuer.id.localizedCaseInsensitiveContains(searchText) ||
            // Search in credential subject claims
            credential.credentialSubject.claims.values.joined().localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        if !filteredCredentials.isEmpty {
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                Text("Search Results")
                    .font(VitalCVFonts.headline)
                    .foregroundColor(.walletText)
                    .padding(.horizontal, WalletSpacing.md)

                ForEach(filteredCredentials) { credential in
                    Button(action: {
                        onCredentialTap(credential)
                    }) {
                        CredentialCard(credential: credential, onTap: {})
                            .padding(.horizontal, WalletSpacing.md)
                    }
                }
            }
        }
    }
}

