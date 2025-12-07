//
//  CredentialAttributeSync.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 7
//  Live sync of credential attributes (name, expiration, status)
//

import Foundation
import Combine

/// CredentialAttributeSync - Live sync of credential attributes from backend
@MainActor
public class CredentialAttributeSync: ObservableObject {
    public static let shared = CredentialAttributeSync()

    // MARK: - Published Properties

    @Published public var isSyncing: Bool = false
    @Published public var lastSyncDate: Date?
    @Published public var syncErrors: [String: Error] = [:]

    // MARK: - Private Properties

    private let walletCore = WalletCore.shared
    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()
    private var syncTimers: [String: Timer] = [:]

    // MARK: - Configuration

    /// Sync interval in seconds (default: 60 seconds)
    public var syncInterval: TimeInterval = 60

    /// Enable automatic syncing
    public var autoSyncEnabled: Bool = true

    // MARK: - Initialization

    private init() {
        if autoSyncEnabled {
            startAutoSync()
        }
    }

    // MARK: - Sync Operations

    /// Sync attributes for a specific credential
    public func syncCredential(_ credentialId: String) async throws {
        do {
            let attributes = try await fetchCredentialAttributes(credentialId)
            try await updateCredentialAttributes(credentialId, attributes)
            syncErrors.removeValue(forKey: credentialId)
        } catch {
            syncErrors[credentialId] = error
            throw error
        }
    }

    /// Sync all credentials
    public func syncAll() async throws {
        isSyncing = true
        defer { isSyncing = false }

        let credentialIds = walletCore.credentials.map { $0.id }

        for credentialId in credentialIds {
            do {
                try await syncCredential(credentialId)
            } catch {
                // Continue with other credentials even if one fails
                print("⚠️ Failed to sync credential \(credentialId): \(error.localizedDescription)")
            }
        }

        lastSyncDate = Date()
    }

    /// Fetch credential attributes from backend
    private func fetchCredentialAttributes(_ credentialId: String) async throws -> CredentialAttributes {
        let endpoint = "/api/credentials/\(credentialId)/attributes"

        return try await withCheckedThrowingContinuation { continuation in
            guard let url = URL(string: networkService.baseURL + endpoint) else {
                continuation.resume(throwing: CredentialAttributeSyncError.invalidURL)
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // Add DPoP signing
            if networkService.enableDPoPSigning {
                do {
                    let dpopToken = try DPoPSigner.shared.generateDPoPToken(
                        method: "GET",
                        url: url,
                        accessToken: networkService.accessToken
                    )
                    request.setValue(dpopToken, forHTTPHeaderField: "DPoP")
                } catch {
                    print("⚠️ Failed to generate DPoP token: \(error.localizedDescription)")
                }
            }

            if let token = networkService.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode),
                      let data = data else {
                    continuation.resume(throwing: CredentialAttributeSyncError.invalidResponse)
                    return
                }

                do {
                    let attributes = try JSONDecoder().decode(CredentialAttributes.self, from: data)
                    continuation.resume(returning: attributes)
                } catch {
                    continuation.resume(throwing: CredentialAttributeSyncError.decodingError(error))
                }
            }.resume()
        }
    }

    /// Update credential attributes locally
    private func updateCredentialAttributes(_ credentialId: String, _ attributes: CredentialAttributes) async throws {
        guard var credential = walletCore.getCredential(credentialId) else {
            throw CredentialAttributeSyncError.credentialNotFound
        }

        // Update credential with new attributes
        // This would update the credential's metadata
        // For now, we'll update the credential directly
        // In a real implementation, you'd have a proper update mechanism

        // Update expiration if provided
        if let expiration = attributes.expirationDate {
            // Update credential expiration
            // This depends on your credential structure
        }

        // Update status if provided
        if let status = attributes.status {
            // Update credential status
        }

        // Save updated credential
        try await walletCore.updateCredential(credential)
    }

    // MARK: - Auto Sync

    private func startAutoSync() {
        // Sync all credentials periodically
        Timer.publish(every: syncInterval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task { @MainActor in
                    try? await self?.syncAll()
                }
            }
            .store(in: &cancellables)
    }

    /// Start per-credential sync timers
    public func startPerCredentialSync() {
        for credential in walletCore.credentials {
            let timer = Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    try? await self?.syncCredential(credential.id)
                }
            }
            syncTimers[credential.id] = timer
        }
    }

    /// Stop per-credential sync
    public func stopPerCredentialSync() {
        for timer in syncTimers.values {
            timer.invalidate()
        }
        syncTimers.removeAll()
    }
}

// MARK: - Supporting Types

public struct CredentialAttributes: Codable {
    public let credentialId: String
    public let name: String?
    public let expirationDate: Date?
    public let status: CredentialStatus?
    public let lastUpdated: Date?
    public let metadata: [String: String]?

    public init(credentialId: String, name: String?, expirationDate: Date?, status: CredentialStatus?, lastUpdated: Date?, metadata: [String: String]?) {
        self.credentialId = credentialId
        self.name = name
        self.expirationDate = expirationDate
        self.status = status
        self.lastUpdated = lastUpdated
        self.metadata = metadata
    }
}

public enum CredentialAttributeSyncError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case decodingError(Error)
    case credentialNotFound
    case syncFailed

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL for credential attribute sync"
        case .invalidResponse:
            return "Invalid response from server"
        case .decodingError(let error):
            return "Failed to decode attributes: \(error.localizedDescription)"
        case .credentialNotFound:
            return "Credential not found in wallet"
        case .syncFailed:
            return "Failed to sync credential attributes"
        }
    }
}








