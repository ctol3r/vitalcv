//
//  CredentialCachePolicy.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 2
//  Cache policy with refresh intervals for credentials
//

import Foundation

/// CredentialCachePolicy - Defines refresh intervals for credential caching
public struct CredentialCachePolicy {
    // MARK: - Refresh Intervals

    /// Refresh interval for active credentials (credentials in use)
    public let activeCredentialRefreshInterval: TimeInterval

    /// Refresh interval for inactive credentials (not recently viewed)
    public let inactiveCredentialRefreshInterval: TimeInterval

    /// Refresh interval for expired credentials (still cached for reference)
    public let expiredCredentialRefreshInterval: TimeInterval

    /// Refresh interval for chain anchor status
    public let chainAnchorRefreshInterval: TimeInterval

    /// Refresh interval for issuer metadata
    public let issuerMetadataRefreshInterval: TimeInterval

    /// Refresh interval for trust scores
    public let trustScoreRefreshInterval: TimeInterval

    // MARK: - Cache Expiration

    /// Maximum age for cached credentials before forced refresh
    public let maxCacheAge: TimeInterval

    /// Maximum age for cached chain status before forced refresh
    public let maxChainCacheAge: TimeInterval

    // MARK: - Initialization

    public init(
        activeCredentialRefreshInterval: TimeInterval = 300,      // 5 minutes
        inactiveCredentialRefreshInterval: TimeInterval = 3600,   // 1 hour
        expiredCredentialRefreshInterval: TimeInterval = 86400,   // 24 hours
        chainAnchorRefreshInterval: TimeInterval = 60,            // 1 minute
        issuerMetadataRefreshInterval: TimeInterval = 3600,       // 1 hour
        trustScoreRefreshInterval: TimeInterval = 600,            // 10 minutes
        maxCacheAge: TimeInterval = 86400,                        // 24 hours
        maxChainCacheAge: TimeInterval = 300                       // 5 minutes
    ) {
        self.activeCredentialRefreshInterval = activeCredentialRefreshInterval
        self.inactiveCredentialRefreshInterval = inactiveCredentialRefreshInterval
        self.expiredCredentialRefreshInterval = expiredCredentialRefreshInterval
        self.chainAnchorRefreshInterval = chainAnchorRefreshInterval
        self.issuerMetadataRefreshInterval = issuerMetadataRefreshInterval
        self.trustScoreRefreshInterval = trustScoreRefreshInterval
        self.maxCacheAge = maxCacheAge
        self.maxChainCacheAge = maxChainCacheAge
    }

    // MARK: - Preset Policies

    /// Aggressive refresh policy (for high-security scenarios)
    public static let aggressive = CredentialCachePolicy(
        activeCredentialRefreshInterval: 60,      // 1 minute
        inactiveCredentialRefreshInterval: 300,   // 5 minutes
        expiredCredentialRefreshInterval: 3600,   // 1 hour
        chainAnchorRefreshInterval: 30,           // 30 seconds
        issuerMetadataRefreshInterval: 1800,     // 30 minutes
        trustScoreRefreshInterval: 120,           // 2 minutes
        maxCacheAge: 3600,                        // 1 hour
        maxChainCacheAge: 60                      // 1 minute
    )

    /// Balanced refresh policy (default)
    public static let balanced = CredentialCachePolicy()

    /// Conservative refresh policy (for battery-saving scenarios)
    public static let conservative = CredentialCachePolicy(
        activeCredentialRefreshInterval: 600,     // 10 minutes
        inactiveCredentialRefreshInterval: 7200,   // 2 hours
        expiredCredentialRefreshInterval: 172800, // 48 hours
        chainAnchorRefreshInterval: 300,          // 5 minutes
        issuerMetadataRefreshInterval: 7200,      // 2 hours
        trustScoreRefreshInterval: 1800,          // 30 minutes
        maxCacheAge: 172800,                      // 48 hours
        maxChainCacheAge: 600                     // 10 minutes
    )

    // MARK: - Cache Status Calculation

    /// Calculate refresh interval for a credential based on its state
    public func refreshInterval(for credential: VerifiableCredential, isActive: Bool) -> TimeInterval {
        if credential.isExpired {
            return expiredCredentialRefreshInterval
        }
        return isActive ? activeCredentialRefreshInterval : inactiveCredentialRefreshInterval
    }

    /// Check if cached data should be refreshed
    public func shouldRefresh(cachedAt: Date, refreshInterval: TimeInterval) -> Bool {
        let elapsed = Date().timeIntervalSince(cachedAt)
        return elapsed >= refreshInterval
    }

    /// Check if cached data has exceeded maximum age
    public func isExpired(cachedAt: Date, maxAge: TimeInterval) -> Bool {
        let elapsed = Date().timeIntervalSince(cachedAt)
        return elapsed >= maxAge
    }
}

/// CredentialCacheEntry - Represents a cached credential with metadata
public struct CredentialCacheEntry {
    public let credential: VerifiableCredential
    public let cachedAt: Date
    public let lastAccessed: Date
    public let accessCount: Int
    public let chainStatus: ChainAnchorStatus?
    public let trustScore: Double?

    public init(
        credential: VerifiableCredential,
        cachedAt: Date = Date(),
        lastAccessed: Date = Date(),
        accessCount: Int = 1,
        chainStatus: ChainAnchorStatus? = nil,
        trustScore: Double? = nil
    ) {
        self.credential = credential
        self.cachedAt = cachedAt
        self.lastAccessed = lastAccessed
        self.accessCount = accessCount
        self.chainStatus = chainStatus
        self.trustScore = trustScore
    }

    /// Create updated entry with new access
    public func withAccess() -> CredentialCacheEntry {
        CredentialCacheEntry(
            credential: credential,
            cachedAt: cachedAt,
            lastAccessed: Date(),
            accessCount: accessCount + 1,
            chainStatus: chainStatus,
            trustScore: trustScore
        )
    }

    /// Create updated entry with new chain status
    public func withChainStatus(_ status: ChainAnchorStatus) -> CredentialCacheEntry {
        CredentialCacheEntry(
            credential: credential,
            cachedAt: cachedAt,
            lastAccessed: lastAccessed,
            accessCount: accessCount,
            chainStatus: status,
            trustScore: trustScore
        )
    }

    /// Create updated entry with new trust score
    public func withTrustScore(_ score: Double) -> CredentialCacheEntry {
        CredentialCacheEntry(
            credential: credential,
            cachedAt: cachedAt,
            lastAccessed: lastAccessed,
            accessCount: accessCount,
            chainStatus: chainStatus,
            trustScore: score
        )
    }
}

// MARK: - ChainAnchorStatus (if not already defined)

public struct ChainAnchorStatus: Codable, Equatable {
    public let anchorId: String
    public let txHash: String?
    public let blockNumber: Int?
    public let confirmed: Bool
    public let timestamp: Date
    public let confidence: Double

    public init(
        anchorId: String,
        txHash: String? = nil,
        blockNumber: Int? = nil,
        confirmed: Bool = false,
        timestamp: Date = Date(),
        confidence: Double = 0.0
    ) {
        self.anchorId = anchorId
        self.txHash = txHash
        self.blockNumber = blockNumber
        self.confirmed = confirmed
        self.timestamp = timestamp
        self.confidence = confidence
    }
}








