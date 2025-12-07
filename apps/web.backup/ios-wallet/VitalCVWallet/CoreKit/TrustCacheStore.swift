//
//  TrustCacheStore.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 13
//  TrustCacheStore: Latest trust states cache
//

import Foundation

/// TrustCacheStore - Cache for latest trust states
/// Stores trust scores and states for credentials to avoid recomputation
@MainActor
class TrustCacheStore: ObservableObject {
    static let shared = TrustCacheStore()

    private let cache = NSCache<NSString, TrustCacheEntry>()
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let maxCacheAge: TimeInterval = 24 * 60 * 60 // 24 hours

    private init() {
        // Setup in-memory cache
        cache.countLimit = 100
        cache.totalCostLimit = 10 * 1024 * 1024 // 10 MB

        // Setup disk cache directory
        let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        cacheDirectory = documentsURL.appendingPathComponent("TrustCache", isDirectory: true)

        // Create directory if needed
        if !fileManager.fileExists(atPath: cacheDirectory.path) {
            try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        }

        // Load cache from disk
        Task {
            await loadCacheFromDisk()
        }
    }

    // MARK: - Public API

    /// Store trust state for credential
    func storeTrustState(for credentialId: String, trustState: TrustState) async {
        let entry = TrustCacheEntry(
            credentialId: credentialId,
            trustState: trustState,
            cachedAt: Date()
        )

        // Store in memory cache
        cache.setObject(entry, forKey: credentialId as NSString)

        // Persist to disk
        await persistToDisk(entry)
    }

    /// Load trust state for credential
    func loadTrustState(for credentialId: String) async -> TrustState? {
        // Check memory cache first
        if let entry = cache.object(forKey: credentialId as NSString) {
            // Check if cache is still valid
            if Date().timeIntervalSince(entry.cachedAt) < maxCacheAge {
                return entry.trustState
            } else {
                // Remove stale entry
                cache.removeObject(forKey: credentialId as NSString)
            }
        }

        // Load from disk
        if let entry = await loadFromDisk(credentialId: credentialId) {
            // Check if cache is still valid
            if Date().timeIntervalSince(entry.cachedAt) < maxCacheAge {
                // Restore to memory cache
                cache.setObject(entry, forKey: credentialId as NSString)
                return entry.trustState
            } else {
                // Remove stale entry
                await removeFromDisk(credentialId: credentialId)
            }
        }

        return nil
    }

    /// Invalidate trust state for credential
    func invalidate(for credentialId: String) async {
        cache.removeObject(forKey: credentialId as NSString)
        await removeFromDisk(credentialId: credentialId)
    }

    /// Clear all cached trust states
    func clearAll() async {
        cache.removeAllObjects()

        // Clear disk cache
        if let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) {
            for fileURL in contents {
                try? fileManager.removeItem(at: fileURL)
            }
        }
    }

    /// Clean up stale entries
    func cleanupStaleEntries() async {
        let now = Date()

        // Clean memory cache
        // NSCache handles eviction automatically

        // Clean disk cache
        if let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) {
            for fileURL in contents {
                if let entry = await loadFromDisk(fileURL: fileURL) {
                    if now.timeIntervalSince(entry.cachedAt) >= maxCacheAge {
                        try? fileManager.removeItem(at: fileURL)
                    }
                }
            }
        }
    }

    // MARK: - Disk Persistence

    private func persistToDisk(_ entry: TrustCacheEntry) async {
        let fileURL = cacheDirectory.appendingPathComponent("\(entry.credentialId).json")

        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(entry)
            try data.write(to: fileURL)
        } catch {
            print("Failed to persist trust cache: \(error)")
        }
    }

    private func loadFromDisk(credentialId: String) async -> TrustCacheEntry? {
        let fileURL = cacheDirectory.appendingPathComponent("\(credentialId).json")
        return await loadFromDisk(fileURL: fileURL)
    }

    private func loadFromDisk(fileURL: URL) async -> TrustCacheEntry? {
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(TrustCacheEntry.self, from: data)
        } catch {
            print("Failed to load trust cache: \(error)")
            return nil
        }
    }

    private func loadCacheFromDisk() async {
        guard let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) else {
            return
        }

        for fileURL in contents where fileURL.pathExtension == "json" {
            if let entry = await loadFromDisk(fileURL: fileURL) {
                // Restore to memory cache if valid
                if Date().timeIntervalSince(entry.cachedAt) < maxCacheAge {
                    cache.setObject(entry, forKey: entry.credentialId as NSString)
                }
            }
        }
    }

    private func removeFromDisk(credentialId: String) async {
        let fileURL = cacheDirectory.appendingPathComponent("\(credentialId).json")
        try? fileManager.removeItem(at: fileURL)
    }
}

// MARK: - Models

class TrustCacheEntry: NSObject, Codable {
    let credentialId: String
    let trustState: TrustState
    let cachedAt: Date

    init(credentialId: String, trustState: TrustState, cachedAt: Date) {
        self.credentialId = credentialId
        self.trustState = trustState
        self.cachedAt = cachedAt
        super.init()
    }
}

struct TrustState: Codable {
    let trustScore: Double
    let chainScore: Double
    let issuerScore: Double
    let complianceScore: Double
    let isVerified: Bool
    let verifiedAt: Date?
    let chainAnchorStatus: String?
    let issuerTrustLevel: String?
}

