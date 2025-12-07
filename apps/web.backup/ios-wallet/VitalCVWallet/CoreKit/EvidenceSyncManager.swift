//
//  EvidenceSyncManager.swift
//  VitalCVWallet
//
//  Created: Batch 138-A - Task 4
//  Evidence synchronization manager
//

import Foundation
import SwiftUI
import Combine

/// EvidenceSyncManager - Manages evidence synchronization for credentials
@MainActor
public class EvidenceSyncManager: ObservableObject {
    public static let shared = EvidenceSyncManager()

    // MARK: - Published State

    /// Evidence sync status per credential
    @Published public var syncStatuses: [String: EvidenceSyncStatus] = [:]

    /// Evidence versions cache
    @Published public var evidenceVersions: [String: [EvidenceVersion]] = [:]

    /// Pending evidence updates
    @Published public var pendingUpdates: [EvidenceUpdate] = []

    // MARK: - Private State

    private var cancellables = Set<AnyCancellable>()
    private var syncTasks: [String: Task<Void, Never>] = [:]

    // MARK: - Initialization

    private init() {
        setupObservers()
    }

    // MARK: - Public API

    /// Sync evidence for a credential
    public func syncEvidence(for credentialId: String) async throws {
        syncStatuses[credentialId] = .syncing

        defer {
            syncStatuses[credentialId] = .idle
        }

        // Fetch evidence from server
        let networkService = NetworkService.shared
        let url = URL(string: "\(networkService.baseURL)/api/credentials/\(credentialId)/evidence")!

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(EvidenceResponse.self, from: data)

            // Update evidence versions
            evidenceVersions[credentialId] = response.versions

            // Compare with local evidence
            await compareEvidence(credentialId: credentialId, versions: response.versions)

        } catch {
            syncStatuses[credentialId] = .error(error)
            throw error
        }
    }

    /// Get evidence versions for a credential
    public func getEvidenceVersions(for credentialId: String) -> [EvidenceVersion] {
        return evidenceVersions[credentialId] ?? []
    }

    /// Compare evidence digests
    public func compareEvidenceDigests(
        local: [String],
        remote: [String]
    ) -> EvidenceComparison {
        let localSet = Set(local)
        let remoteSet = Set(remote)

        let missing = remoteSet.subtracting(localSet)
        let extra = localSet.subtracting(remoteSet)
        let matching = localSet.intersection(remoteSet)

        return EvidenceComparison(
            matching: Array(matching),
            missing: Array(missing),
            extra: Array(extra)
        )
    }

    /// Handle evidence mismatch
    public func handleEvidenceMismatch(
        credentialId: String,
        comparison: EvidenceComparison
    ) {
        let update = EvidenceUpdate(
            credentialId: credentialId,
            type: .mismatch,
            comparison: comparison,
            timestamp: Date()
        )

        pendingUpdates.append(update)

        // Notify via event bus
        NotificationCenter.default.post(
            name: .evidenceMismatchDetected,
            object: nil,
            userInfo: [
                "credentialId": credentialId,
                "comparison": comparison
            ]
        )
    }

    // MARK: - Private Methods

    private func compareEvidence(credentialId: String, versions: [EvidenceVersion]) async {
        // Get local credential
        let appState = AppStateContainer.shared
        guard let credential = appState.credentials.first(where: { $0.id == credentialId }) else {
            return
        }

        // Extract local evidence digests
        let localDigests = credential.evidence?.map { $0.id } ?? []

        // Extract remote evidence digests
        let remoteDigests = versions.map { $0.digest }

        // Compare
        let comparison = compareEvidenceDigests(
            local: localDigests,
            remote: remoteDigests
        )

        // If mismatch, handle it
        if !comparison.missing.isEmpty || !comparison.extra.isEmpty {
            handleEvidenceMismatch(credentialId: credentialId, comparison: comparison)
        }
    }

    private func setupObservers() {
        // Observe credential updates
        NotificationCenter.default.publisher(for: .credentialsDidUpdate)
            .sink { [weak self] notification in
                guard let self = self,
                      let credentialId = notification.userInfo?["credentialId"] as? String else {
                    return
                }

                Task {
                    try? await self.syncEvidence(for: credentialId)
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Supporting Types

public enum EvidenceSyncStatus {
    case idle
    case syncing
    case error(Error)
}

public struct EvidenceVersion: Codable, Identifiable {
    public let id: String
    public let digest: String
    public let timestamp: Date
    public let source: String
    public let metadata: [String: String]?
}

public struct EvidenceUpdate: Identifiable {
    public let id = UUID()
    public let credentialId: String
    public let type: EvidenceUpdateType
    public let comparison: EvidenceComparison?
    public let timestamp: Date
}

public enum EvidenceUpdateType {
    case new
    case updated
    case mismatch
    case removed
}

public struct EvidenceComparison {
    public let matching: [String]
    public let missing: [String]
    public let extra: [String]

    public var hasMismatch: Bool {
        return !missing.isEmpty || !extra.isEmpty
    }
}

public struct EvidenceResponse: Codable {
    public let credentialId: String
    public let versions: [EvidenceVersion]
    public let lastUpdated: Date
}

// MARK: - Notification Names

extension Notification.Name {
    static let evidenceMismatchDetected = Notification.Name("evidenceMismatchDetected")
}




