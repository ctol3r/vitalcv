//
//  CredentialFavoriteManager.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 13
//  "Favorite Credential" pinning
//

import Foundation
import SwiftUI

@MainActor
class CredentialFavoriteManager: ObservableObject {
    static let shared = CredentialFavoriteManager()

    @Published private(set) var favoriteCredentialIds: Set<String> = []

    private let favoritesKey = "wallet.favorites"
    private let keychain = KeychainService.shared

    private init() {
        loadFavorites()
    }

    func isFavorite(_ credentialId: String) -> Bool {
        favoriteCredentialIds.contains(credentialId)
    }

    func toggleFavorite(_ credentialId: String) {
        if favoriteCredentialIds.contains(credentialId) {
            favoriteCredentialIds.remove(credentialId)
        } else {
            favoriteCredentialIds.insert(credentialId)
        }
        saveFavorites()
    }

    func setFavorite(_ credentialId: String, isFavorite: Bool) {
        if isFavorite {
            favoriteCredentialIds.insert(credentialId)
        } else {
            favoriteCredentialIds.remove(credentialId)
        }
        saveFavorites()
    }

    func getFavoriteCredential(from credentials: [VerifiableCredential]) -> VerifiableCredential? {
        guard let favoriteId = favoriteCredentialIds.first(where: { id in
            credentials.contains { $0.id == id }
        }) else {
            return nil
        }
        return credentials.first { $0.id == favoriteId }
    }

    private func loadFavorites() {
        guard let data = keychain.load(key: favoritesKey),
              let favorites = try? JSONDecoder().decode(Set<String>.self, from: data) else {
            return
        }
        favoriteCredentialIds = favorites
    }

    private func saveFavorites() {
        guard let data = try? JSONEncoder().encode(favoriteCredentialIds) else {
            return
        }
        _ = keychain.save(data: data, key: favoritesKey)
    }
}

// MARK: - Favorite Badge View

struct FavoriteBadge: View {
    let isFavorite: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: {
            HapticFeedbackService.shared.cardTapped()
            onToggle()
        }) {
            Image(systemName: isFavorite ? "star.fill" : "star")
                .font(.system(size: 20))
                .foregroundColor(isFavorite ? .walletAccent : .walletTextSecondary)
        }
        .buttonStyle(PlainButtonStyle())
    }
}








