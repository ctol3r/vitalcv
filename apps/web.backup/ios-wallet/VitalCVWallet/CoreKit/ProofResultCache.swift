//
//  ProofResultCache.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 16
//  Add caching layer for proof results
//

import Foundation

/// ProofResultCache - Caches proof verification results
public class ProofResultCache {
    public static let shared = ProofResultCache()

    private var cache: [String: CachedProofResult] = [:]
    private let maxCacheSize = 100
    private let cacheExpirationInterval: TimeInterval = 3600 // 1 hour

    private init() {
        // Clean expired entries periodically
        Task {
            await cleanExpiredEntries()
        }
    }

    /// Cache proof result
    public func cacheResult(
        credentialId: String,
        result: VerificationResult,
        trustScore: TrustScore?
    ) {
        let cached = CachedProofResult(
            result: result,
            trustScore: trustScore,
            timestamp: Date()
        )

        cache[credentialId] = cached

        // Evict oldest if cache is full
        if cache.count > maxCacheSize {
            evictOldest()
        }
    }

    /// Get cached result
    public func getCachedResult(credentialId: String) -> (VerificationResult, TrustScore?)? {
        guard let cached = cache[credentialId] else {
            return nil
        }

        // Check if expired
        let age = Date().timeIntervalSince(cached.timestamp)
        if age > cacheExpirationInterval {
            cache.removeValue(forKey: credentialId)
            return nil
        }

        return (cached.result, cached.trustScore)
    }

    /// Clear cache for specific credential
    public func clearCache(for credentialId: String) {
        cache.removeValue(forKey: credentialId)
    }

    /// Clear all cache
    public func clearAll() {
        cache.removeAll()
    }

    // MARK: - Private Methods

    private func evictOldest() {
        guard let oldest = cache.min(by: { $0.value.timestamp < $1.value.timestamp }) else {
            return
        }
        cache.removeValue(forKey: oldest.key)
    }

    private func cleanExpiredEntries() async {
        while true {
            try? await Task.sleep(nanoseconds: 3600_000_000_000) // 1 hour

            let now = Date()
            let expiredKeys = cache.filter { key, value in
                now.timeIntervalSince(value.timestamp) > cacheExpirationInterval
            }.map { $0.key }

            for key in expiredKeys {
                cache.removeValue(forKey: key)
            }
        }
    }
}

// MARK: - Models

private struct CachedProofResult {
    let result: VerificationResult
    let trustScore: TrustScore?
    let timestamp: Date
}

