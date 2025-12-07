//
//  AppInitializationPipeline.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 5
//  App initialization pipeline: DID setup + cache load
//

import Foundation
import Combine

/// AppInitializationPipeline - Orchestrates app initialization
/// Handles DID setup, cache loading, and service initialization
@MainActor
class AppInitializationPipeline: ObservableObject {
    static let shared = AppInitializationPipeline()

    enum InitializationPhase: Int, CaseIterable {
        case starting = 0
        case didSetup = 1
        case cacheLoad = 2
        case serviceInit = 3
        case credentialSync = 4
        case trustCacheLoad = 5
        case complete = 6
    }

    @Published var currentPhase: InitializationPhase = .starting
    @Published var isInitializing: Bool = false
    @Published var progress: Double = 0.0
    @Published var error: Error?
    @Published var isComplete: Bool = false

    private var cancellables = Set<AnyCancellable>()

    private init() {}

    /// Start the initialization pipeline
    func start() async {
        guard !isInitializing else { return }

        isInitializing = true
        error = nil
        isComplete = false
        currentPhase = .starting

        do {
            // Phase 1: DID Setup
            await updatePhase(.didSetup)
            try await setupDID()

            // Phase 2: Cache Load
            await updatePhase(.cacheLoad)
            await loadCaches()

            // Phase 3: Service Initialization
            await updatePhase(.serviceInit)
            await initializeServices()

            // Phase 4: Credential Sync
            await updatePhase(.credentialSync)
            await syncCredentials()

            // Phase 5: Trust Cache Load
            await updatePhase(.trustCacheLoad)
            await loadTrustCache()

            // Phase 6: Complete
            await updatePhase(.complete)
            try await Task.sleep(nanoseconds: 300_000_000) // 0.3s

            isComplete = true
            isInitializing = false
        } catch {
            self.error = error
            isInitializing = false

            // Log error via error handler
            ErrorHandler.shared.handle(error, context: "App Initialization")
        }
    }

    private func updatePhase(_ phase: InitializationPhase) async {
        currentPhase = phase
        let phaseProgress = Double(phase.rawValue) / Double(InitializationPhase.allCases.count - 1)
        progress = phaseProgress
    }

    // MARK: - Phase 1: DID Setup

    private func setupDID() async throws {
        // Check if DID already exists
        if DIDService.shared.hasDID() {
            // Load existing DID
            if let did = KeychainService.shared.loadDID() {
                AppStateContainer.shared.authenticate(did: did)
                return
            }
        }

        // Create new DID if needed
        let did = try await DIDService.shared.createDID()
        AppStateContainer.shared.authenticate(did: did)

        // Store DID in Keychain
        KeychainService.shared.saveDID(did)
    }

    // MARK: - Phase 2: Cache Load

    private func loadCaches() async {
        // Load credentials from cache
        if let credentialsData = KeychainService.shared.loadCredentials(),
           let credentials = try? JSONDecoder().decode([VerifiableCredential].self, from: credentialsData) {
            AppStateContainer.shared.credentials = credentials
        }

        // Load image cache metadata
        await ImageCache.shared.preloadCommonImages()

        // Load issuer registry cache
        await VerifiedIssuerRegistry.shared.loadCache()
    }

    // MARK: - Phase 3: Service Initialization

    private func initializeServices() async {
        // Initialize AppServicesContainer
        await AppServicesContainer.shared.initialize()

        // Initialize WalletCore
        await WalletCore.shared.initialize()

        // Initialize TrustEngine
        await TrustEngine.shared.initialize()

        // Initialize NetworkService
        await AsyncNetworkService.shared.initialize()
    }

    // MARK: - Phase 4: Credential Sync

    private func syncCredentials() async {
        // Only sync if authenticated and online
        guard AppStateContainer.shared.isAuthenticated,
              AppStateContainer.shared.isOnline else {
            return
        }

        // Sync credentials from server
        do {
            if let did = AppStateContainer.shared.currentUserDid {
                let syncedCredentials = try await CredentialSyncManager.shared.syncCredentials(for: did)

                // Update local state
                AppStateContainer.shared.credentials = syncedCredentials

                // Persist to Keychain
                if let encoded = try? JSONEncoder().encode(syncedCredentials) {
                    KeychainService.shared.saveCredentials(encoded)
                }
            }
        } catch {
            // Log but don't fail initialization
            ErrorHandler.shared.handle(error, context: "Credential Sync")
        }
    }

    // MARK: - Phase 5: Trust Cache Load

    private func loadTrustCache() async {
        // Load trust cache for all credentials
        for credential in AppStateContainer.shared.credentials {
            // Load cached trust state
            if let cachedTrust = await TrustCacheStore.shared.loadTrustState(for: credential.id) {
                // Update trust state if needed
                // This would be handled by TrustEngine
            }
        }

        // Load chain snapshots
        await ChainSnapshotStore.shared.loadSnapshots()
    }
}

