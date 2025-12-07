//
//  CredentialSyncManager.swift
//  VitalCVWallet
//
//  Created: Batch 138-A - Task 3
//  Scheduled + push-driven credential synchronization
//

import Foundation
import SwiftUI
import Combine
import BackgroundTasks

/// CredentialSyncManager - Manages credential synchronization (scheduled + push-driven)
@MainActor
public class CredentialSyncManager: ObservableObject {
    public static let shared = CredentialSyncManager()

    // MARK: - Published State

    /// Sync status
    @Published public var syncStatus: SyncStatus = .idle

    /// Last sync timestamp
    @Published public var lastSyncDate: Date?

    /// Next scheduled sync date
    @Published public var nextSyncDate: Date?

    /// Sync error if any
    @Published public var syncError: Error?

    /// Credentials pending sync
    @Published public var pendingSyncCount: Int = 0

    /// Sync progress (0.0 to 1.0)
    @Published public var syncProgress: Double = 0.0

    // MARK: - Configuration

    /// Scheduled sync interval (default: 5 minutes)
    public var scheduledSyncInterval: TimeInterval = 300

    /// Push sync enabled
    public var pushSyncEnabled: Bool = true

    /// Background sync enabled
    public var backgroundSyncEnabled: Bool = true

    // MARK: - Private State

    private var syncTask: Task<Void, Never>?
    private var scheduledTimer: Timer?
    private var cancellables = Set<AnyCancellable>()
    private let backgroundTaskIdentifier = "com.vitalcv.credential-sync"

    // MARK: - Initialization

    private init() {
        setupObservers()
        registerBackgroundTask()
    }

    // MARK: - Public API

    /// Start scheduled synchronization
    public func startScheduledSync() {
        guard syncTask == nil else { return }

        // Perform initial sync
        Task {
            await performSync()
        }

        // Schedule periodic sync
        scheduledTimer = Timer.scheduledTimer(withTimeInterval: scheduledSyncInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performSync()
            }
        }
    }

    /// Stop scheduled synchronization
    public func stopScheduledSync() {
        scheduledTimer?.invalidate()
        scheduledTimer = nil
        syncTask?.cancel()
        syncTask = nil
    }

    /// Trigger immediate sync
    public func syncNow() async {
        await performSync(force: true)
    }

    /// Sync specific credential
    public func syncCredential(_ credentialId: String) async throws {
        syncStatus = .syncing
        syncProgress = 0.0

        defer {
            syncStatus = .idle
            syncProgress = 0.0
        }

        // Fetch credential status from server
        let networkService = NetworkService.shared
        let url = URL(string: "\(networkService.baseURL)/api/credentials/\(credentialId)/status")!

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let status = try JSONDecoder().decode(CredentialStatusResponse.self, from: data)

            // Update credential in app state
            await updateCredentialStatus(credentialId: credentialId, status: status)

            // Notify trust event bus
            TrustEventBus.shared.updateTrust(
                credentialId: credentialId,
                score: status.trustScore,
                source: .system
            )

        } catch {
            syncError = error
            throw error
        }
    }

    /// Handle push notification for credential update
    public func handlePushUpdate(_ payload: [String: Any]) {
        guard pushSyncEnabled else { return }

        guard let credentialId = payload["credentialId"] as? String,
              let updateType = payload["updateType"] as? String else {
            return
        }

        Task {
            switch updateType {
            case "status_changed":
                try? await syncCredential(credentialId)
            case "revoked":
                await handleRevocation(credentialId: credentialId)
            case "updated":
                try? await syncCredential(credentialId)
            default:
                break
            }
        }
    }

    // MARK: - Private Methods

    private func performSync(force: Bool = false) async {
        guard syncStatus != .syncing || force else { return }

        syncStatus = .syncing
        syncError = nil
        syncProgress = 0.0

        defer {
            syncStatus = .idle
            lastSyncDate = Date()
            nextSyncDate = Date().addingTimeInterval(scheduledSyncInterval)
        }

        // Get credentials that need syncing
        let appState = AppStateContainer.shared
        let credentials = appState.credentials

        guard !credentials.isEmpty else {
            syncProgress = 1.0
            return
        }

        pendingSyncCount = credentials.count
        var syncedCount = 0

        // Sync each credential
        for credential in credentials {
            do {
                try await syncCredential(credential.id)
                syncedCount += 1
                syncProgress = Double(syncedCount) / Double(credentials.count)
            } catch {
                // Log error but continue with other credentials
                print("Failed to sync credential \(credential.id): \(error)")
            }
        }

        pendingSyncCount = 0
        syncProgress = 1.0
    }

    private func updateCredentialStatus(credentialId: String, status: CredentialStatusResponse) async {
        let appState = AppStateContainer.shared
        guard let index = appState.credentials.firstIndex(where: { $0.id == credentialId }) else {
            return
        }

        // Update credential with new status
        // Note: This is a simplified version - in reality, you'd merge the status data
        // into the existing credential object
    }

    private func handleRevocation(credentialId: String) async {
        let appState = AppStateContainer.shared
        appState.credentials.removeAll { $0.id == credentialId }

        // Notify trust event bus
        TrustEventBus.shared.postEvent(TrustEvent(
            type: .credentialTrustChanged,
            credentialId: credentialId,
            timestamp: Date(),
            payload: CredentialTrustChange(
                credentialId: credentialId,
                changeType: .revoked,
                timestamp: Date()
            )
        ))
    }

    private func setupObservers() {
        // Observe app lifecycle
        NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.performSync()
                }
            }
            .store(in: &cancellables)

        // Observe network status
        NotificationCenter.default.publisher(for: .networkStatusChanged)
            .sink { [weak self] notification in
                if let isOnline = notification.userInfo?["isOnline"] as? Bool, isOnline {
                    Task { @MainActor in
                        await self?.performSync()
                    }
                }
            }
            .store(in: &cancellables)
    }

    private func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: backgroundTaskIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleBackgroundSync(task: task as! BGAppRefreshTask)
        }
    }

    private func handleBackgroundSync(task: BGAppRefreshTask) {
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1

        task.expirationHandler = {
            queue.cancelAllOperations()
        }

        queue.addOperation {
            Task { @MainActor in
                await self.performSync()
                task.setTaskCompleted(success: true)
            }
        }

        scheduleBackgroundSync()
    }

    private func scheduleBackgroundSync() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: scheduledSyncInterval)

        try? BGTaskScheduler.shared.submit(request)
    }
}

// MARK: - Supporting Types

public enum SyncStatus {
    case idle
    case syncing
    case error
}

public struct CredentialStatusResponse: Codable {
    public let credentialId: String
    public let status: String
    public let trustScore: Double
    public let chainAnchorStatus: String?
    public let lastUpdated: Date
    public let revocationStatus: String?
}




