//
//  VerifiedIssuerRegistry.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 2
//  VerifiedIssuerRegistry - Local cache of verified issuers with trust levels
//

import Foundation
import Combine

/// VerifiedIssuerRegistry - Local cache of verified issuers
/// Maintains trust levels, verification status, and metadata for issuers
@MainActor
public class VerifiedIssuerRegistry: ObservableObject {
    public static let shared = VerifiedIssuerRegistry()

    // MARK: - Published State

    @Published public private(set) var issuers: [String: VerifiedIssuer] = [:] // issuerId -> issuer
    @Published public private(set) var lastUpdateDate: Date?
    @Published public private(set) var cacheState: CacheState = .empty

    // MARK: - Private Properties

    private let cacheKey = "verified_issuers_cache"
    private let cacheExpirationInterval: TimeInterval = 24 * 60 * 60 // 24 hours
    private let networkService = AsyncNetworkService.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {
        loadCache()
    }

    // MARK: - Cache Management

    /// Load issuers from local cache
    private func loadCache() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let cached = try? JSONDecoder().decode(CachedIssuers.self, from: data) else {
            cacheState = .empty
            return
        }

        // Check if cache is expired
        if let lastUpdate = cached.lastUpdate,
           Date().timeIntervalSince(lastUpdate) > cacheExpirationInterval {
            cacheState = .expired
            return
        }

        issuers = Dictionary(uniqueKeysWithValues: cached.issuers.map { ($0.id, $0) })
        lastUpdateDate = cached.lastUpdate
        cacheState = .valid
    }

    /// Save issuers to local cache
    private func saveCache() {
        let cached = CachedIssuers(
            issuers: Array(issuers.values),
            lastUpdate: Date()
        )

        if let data = try? JSONEncoder().encode(cached) {
            UserDefaults.standard.set(data, forKey: cacheKey)
            lastUpdateDate = Date()
        }
    }

    // MARK: - Issuer Management

    /// Get issuer by ID
    public func getIssuer(_ issuerId: String) -> VerifiedIssuer? {
        return issuers[issuerId]
    }

    /// Check if issuer is verified
    public func isVerified(_ issuerId: String) -> Bool {
        return issuers[issuerId]?.verificationStatus == .verified
    }

    /// Get trust level for issuer
    public func getTrustLevel(_ issuerId: String) -> TrustLevel {
        return issuers[issuerId]?.trustLevel ?? .unknown
    }

    /// Add or update issuer
    public func updateIssuer(_ issuer: VerifiedIssuer) {
        issuers[issuer.id] = issuer
        saveCache()
    }

    /// Remove issuer
    public func removeIssuer(_ issuerId: String) {
        issuers.removeValue(forKey: issuerId)
        saveCache()
    }

    // MARK: - Remote Sync

    /// Fetch verified issuers from remote server
    public func sync() async throws {
        cacheState = .syncing

        defer {
            if cacheState == .syncing {
                cacheState = .valid
            }
        }

        do {
            // AsyncNetworkService is an actor, so we need to await it
            let remoteIssuers: [VerifiedIssuer] = try await networkService.request(
                endpoint: "/api/issuers/verified",
                method: .GET
            )

            // Update local cache
            for issuer in remoteIssuers {
                issuers[issuer.id] = issuer
            }

            saveCache()
        } catch {
            cacheState = .error(error)
            throw error
        }
    }

    /// Refresh cache if expired
    public func refreshIfNeeded() async {
        if cacheState == .expired || cacheState == .empty {
            try? await sync()
        }
    }

    // MARK: - Trust Evaluation

    /// Evaluate trust score for issuer
    public func evaluateTrustScore(_ issuerId: String) -> Double {
        guard let issuer = issuers[issuerId] else {
            return 0.0
        }

        var score: Double = 0.0

        // Base score from verification status
        switch issuer.verificationStatus {
        case .verified:
            score += 50.0
        case .pending:
            score += 25.0
        case .rejected:
            score = 0.0
        case .unknown:
            return 0.0
        }

        // Trust level bonus
        switch issuer.trustLevel {
        case .high:
            score += 30.0
        case .medium:
            score += 15.0
        case .low:
            score += 5.0
        case .unknown:
            break
        }

        // Recency bonus (recently verified issuers get bonus)
        if let verifiedAt = issuer.verifiedAt,
           Date().timeIntervalSince(verifiedAt) < 30 * 24 * 60 * 60 { // 30 days
            score += 10.0
        }

        // Credential count bonus
        if issuer.credentialCount > 0 {
            score += min(Double(issuer.credentialCount) * 2.0, 10.0)
        }

        return min(score, 100.0)
    }
}

// MARK: - Models

public struct VerifiedIssuer: Codable, Identifiable {
    public let id: String
    public let name: String
    public let domain: String?
    public let logoUrl: String?
    public let verificationStatus: VerificationStatus
    public let trustLevel: TrustLevel
    public let verifiedAt: Date?
    public let credentialCount: Int
    public let metadata: [String: String]

    public init(
        id: String,
        name: String,
        domain: String? = nil,
        logoUrl: String? = nil,
        verificationStatus: VerificationStatus = .unknown,
        trustLevel: TrustLevel = .unknown,
        verifiedAt: Date? = nil,
        credentialCount: Int = 0,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.name = name
        self.domain = domain
        self.logoUrl = logoUrl
        self.verificationStatus = verificationStatus
        self.trustLevel = trustLevel
        self.verifiedAt = verifiedAt
        self.credentialCount = credentialCount
        self.metadata = metadata
    }
}

public enum VerificationStatus: String, Codable {
    case verified
    case pending
    case rejected
    case unknown
}

public enum TrustLevel: String, Codable {
    case high
    case medium
    case low
    case unknown
}

public enum CacheState {
    case empty
    case valid
    case expired
    case syncing
    case error(Error)
}

private struct CachedIssuers: Codable {
    let issuers: [VerifiedIssuer]
    let lastUpdate: Date?
}

public enum VerifiedIssuerRegistryError: LocalizedError {
    case invalidResponse
    case syncFailed

    public var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from issuer registry"
        case .syncFailed:
            return "Failed to sync issuer registry"
        }
    }
}

