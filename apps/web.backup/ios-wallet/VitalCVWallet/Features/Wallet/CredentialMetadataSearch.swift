//
//  CredentialMetadataSearch.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 8
//  Search across credential metadata
//

import Foundation
import SwiftUI

/// CredentialMetadataSearch - Search engine for credential metadata
public class CredentialMetadataSearch {
    public static let shared = CredentialMetadataSearch()

    private init() {}

    /// Search credentials by query across all metadata
    public func search(
        credentials: [VerifiableCredential],
        query: String
    ) -> [VerifiableCredential] {
        guard !query.isEmpty else {
            return credentials
        }

        let lowercasedQuery = query.lowercased()

        return credentials.filter { credential in
            // Search in type
            let typeMatch = credential.type.joined().lowercased().contains(lowercasedQuery)

            // Search in issuer name
            let issuerNameMatch = credential.issuer.name?.lowercased().contains(lowercasedQuery) ?? false

            // Search in issuer ID
            let issuerIdMatch = credential.issuer.id.lowercased().contains(lowercasedQuery)

            // Search in credential subject claims
            let claimsMatch = credential.credentialSubject.claims.values
                .joined(separator: " ")
                .lowercased()
                .contains(lowercasedQuery)

            // Search in credential subject type
            let subjectTypeMatch = credential.credentialSubject.type?.lowercased().contains(lowercasedQuery) ?? false

            // Search in evidence descriptions
            let evidenceMatch = credential.evidence?.contains { evidence in
                evidence.description?.lowercased().contains(lowercasedQuery) ?? false ||
                evidence.type.lowercased().contains(lowercasedQuery) ||
                evidence.source.lowercased().contains(lowercasedQuery)
            } ?? false

            // Search in proof type
            let proofMatch = credential.proof?.type.lowercased().contains(lowercasedQuery) ?? false

            return typeMatch || issuerNameMatch || issuerIdMatch || claimsMatch ||
                   subjectTypeMatch || evidenceMatch || proofMatch
        }
    }

    /// Get search suggestions based on query
    public func getSuggestions(
        credentials: [VerifiableCredential],
        query: String
    ) -> [String] {
        guard !query.isEmpty else {
            return []
        }

        let lowercasedQuery = query.lowercased()
        var suggestions: Set<String> = []

        for credential in credentials {
            // Add issuer names
            if let issuerName = credential.issuer.name,
               issuerName.lowercased().contains(lowercasedQuery) {
                suggestions.insert(issuerName)
            }

            // Add credential types
            for type in credential.type {
                if type.lowercased().contains(lowercasedQuery) {
                    suggestions.insert(type)
                }
            }

            // Add claim values
            for (key, value) in credential.credentialSubject.claims {
                if value.lowercased().contains(lowercasedQuery) {
                    suggestions.insert(value)
                }
            }
        }

        return Array(suggestions.prefix(5))
    }
}

/// CredentialSearchBar - Enhanced search bar for credentials
public struct CredentialSearchBar: View {
    @Binding var searchText: String
    let credentials: [VerifiableCredential]
    let onSearch: ([VerifiableCredential]) -> Void

    @State private var suggestions: [String] = []
    @State private var showSuggestions = false

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.walletTextSecondary)

                TextField("Search credentials...", text: $searchText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .onChange(of: searchText) { newValue in
                        performSearch()
                        updateSuggestions()
                    }

                if !searchText.isEmpty {
                    Button(action: {
                        searchText = ""
                        suggestions = []
                        showSuggestions = false
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }
            .padding(WalletSpacing.md)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)

            // Suggestions
            if showSuggestions && !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    ForEach(suggestions, id: \.self) { suggestion in
                        Button(action: {
                            searchText = suggestion
                            showSuggestions = false
                        }) {
                            HStack {
                                Image(systemName: "magnifyingglass")
                                    .foregroundColor(.walletTextSecondary)
                                    .font(.system(size: 12))

                                Text(suggestion)
                                    .font(WalletTypography.subheadline)
                                    .foregroundColor(.walletText)

                                Spacer()
                            }
                            .padding(.horizontal, WalletSpacing.md)
                            .padding(.vertical, WalletSpacing.sm)
                        }
                    }
                }
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
                .walletShadow(WalletShadow.small)
            }
        }
    }

    private func performSearch() {
        let results = CredentialMetadataSearch.shared.search(
            credentials: credentials,
            query: searchText
        )
        onSearch(results)
    }

    private func updateSuggestions() {
        suggestions = CredentialMetadataSearch.shared.getSuggestions(
            credentials: credentials,
            query: searchText
        )
        showSuggestions = !searchText.isEmpty && !suggestions.isEmpty
    }
}

