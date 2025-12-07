//
//  WalletStateStore.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 2
//  WalletStateStore - Synced with backend credentials
//

import Foundation
import Combine

/// WalletStateStore - Centralized state management for wallet credentials
/// Syncs with backend /api/credentials/list endpoint
@MainActor
class WalletStateStore: ObservableObject {
    static let shared = WalletStateStore()

    // MARK: - Published State

    @Published var credentials: [VerifiableCredential] = []
    @Published var isLoading: Bool = false
    @Published var lastSyncError: Error?
    @Published var lastSyncDate: Date?
    @Published var syncState: SyncState = .idle

    // MARK: - Private Properties

    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()
    private var syncTimer: Timer?

    enum SyncState {
        case idle
        case syncing
        case success
        case error(Error)
    }

    private init() {
        // Auto-sync on initialization
        Task {
            await syncWithBackend()
        }
    }

    // MARK: - Backend Sync

    /// Sync credentials from backend /api/credentials/list
    func syncWithBackend() async {
        guard syncState != .syncing else { return }

        await MainActor.run {
            syncState = .syncing
            isLoading = true
            lastSyncError = nil
        }

        do {
            // TODO: Replace with actual endpoint when backend implements /api/credentials/list
            // For now, fetch from WalletCore or AppStateContainer as fallback
            // When backend endpoint is ready, use:
            // let response = try await networkService.fetchCredentialsList()

            // Temporary: Use existing credentials from WalletCore
            let existingCredentials = WalletCore.shared.credentials

            await MainActor.run {
                self.credentials = existingCredentials
                self.syncState = .success
                self.lastSyncDate = Date()
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.lastSyncError = error
                self.syncState = .error(error)
                self.isLoading = false
            }
        }
    }

    /// Start periodic sync (every 30 seconds when app is active)
    func startPeriodicSync() {
        stopPeriodicSync()
        syncTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.syncWithBackend()
            }
        }
    }

    /// Stop periodic sync
    func stopPeriodicSync() {
        syncTimer?.invalidate()
        syncTimer = nil
    }

    // MARK: - Credential Management

    /// Add credential locally (will sync on next sync)
    func addCredential(_ credential: VerifiableCredential) {
        guard !credentials.contains(where: { $0.id == credential.id }) else { return }
        credentials.append(credential)
    }

    /// Remove credential locally
    func removeCredential(_ credentialId: String) {
        credentials.removeAll { $0.id == credentialId }
    }

    /// Update credential locally
    func updateCredential(_ credential: VerifiableCredential) {
        guard let index = credentials.firstIndex(where: { $0.id == credential.id }) else { return }
        credentials[index] = credential
    }
}

// MARK: - NetworkService Extension for Credentials List (Future)

extension NetworkService {
    /// Fetch credentials list from backend
    /// TODO: Implement when /api/credentials/list endpoint is available
    func fetchCredentialsList() async throws -> [VerifiableCredential] {
        // This will be implemented when backend endpoint is ready
        // For now, return empty array
        return []
    }
}

