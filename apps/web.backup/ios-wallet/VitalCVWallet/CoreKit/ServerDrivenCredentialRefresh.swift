//
//  ServerDrivenCredentialRefresh.swift
//  VitalCVWallet
//
//  Created: Batch 138-A - Task 6
//  Server-driven credential status refresh
//

import Foundation
import SwiftUI
import Combine

/// ServerDrivenCredentialRefresh - Handles server-driven credential status updates
@MainActor
public class ServerDrivenCredentialRefresh: ObservableObject {
    public static let shared = ServerDrivenCredentialRefresh()

    // MARK: - Published State

    /// Refresh status
    @Published public var refreshStatus: RefreshStatus = .idle

    /// Last refresh timestamp
    @Published public var lastRefreshDate: Date?

    /// Credentials with pending updates
    @Published public var pendingUpdates: Set<String> = []

    // MARK: - Private State

    private var refreshTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()
    private let networkService = NetworkService.shared

    // MARK: - Initialization

    private init() {
        setupObservers()
    }

    // MARK: - Public API

    /// Refresh credential status from server
    public func refreshCredentialStatus(_ credentialId: String) async throws {
        pendingUpdates.insert(credentialId)
        refreshStatus = .refreshing

        defer {
            pendingUpdates.remove(credentialId)
            if pendingUpdates.isEmpty {
                refreshStatus = .idle
                lastRefreshDate = Date()
            }
        }

        // Fetch status from server
        let url = URL(string: "\(networkService.baseURL)/api/credentials/\(credentialId)/status")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ServerRefreshError.invalidResponse
        }

        let statusResponse = try JSONDecoder().decode(CredentialStatusResponse.self, from: data)

        // Update credential in app state
        await updateCredentialWithStatus(credentialId: credentialId, status: statusResponse)

        // Notify trust event bus
        TrustEventBus.shared.updateTrust(
            credentialId: credentialId,
            score: statusResponse.trustScore,
            source: .system
        )
    }

    /// Batch refresh multiple credentials
    public func refreshCredentials(_ credentialIds: [String]) async {
        refreshStatus = .refreshing

        await withTaskGroup(of: Void.self) { group in
            for credentialId in credentialIds {
                group.addTask {
                    try? await self.refreshCredentialStatus(credentialId)
                }
            }
        }

        refreshStatus = .idle
        lastRefreshDate = Date()
    }

    /// Handle push notification for credential update
    public func handlePushUpdate(_ payload: [String: Any]) {
        guard let credentialId = payload["credentialId"] as? String else {
            return
        }

        Task {
            try? await refreshCredentialStatus(credentialId)
        }
    }

    // MARK: - Private Methods

    private func updateCredentialWithStatus(credentialId: String, status: CredentialStatusResponse) async {
        let appState = AppStateContainer.shared

        // Find and update credential
        if let index = appState.credentials.firstIndex(where: { $0.id == credentialId }) {
            // In a real implementation, you would merge the status data
            // into the existing credential object
            // For now, we'll just trigger a notification
            NotificationCenter.default.post(
                name: .credentialStatusUpdated,
                object: nil,
                userInfo: [
                    "credentialId": credentialId,
                    "status": status
                ]
            )
        }
    }

    private func setupObservers() {
        // Observe app becoming active
        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.refreshAllCredentials()
                }
            }
            .store(in: &cancellables)
    }

    private func refreshAllCredentials() async {
        let appState = AppStateContainer.shared
        let credentialIds = appState.credentials.map { $0.id }
        await refreshCredentials(credentialIds)
    }
}

// MARK: - Supporting Types

public enum RefreshStatus {
    case idle
    case refreshing
    case error(Error)
}

public enum ServerRefreshError: LocalizedError {
    case invalidResponse
    case networkError
    case decodingError

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .networkError:
            return "Network error occurred"
        case .decodingError:
            return "Failed to decode response"
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let credentialStatusUpdated = Notification.Name("credentialStatusUpdated")
}




