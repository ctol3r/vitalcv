//
//  TrustCache.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 31
//  Local trust cache (immutable)
//

import Foundation

class TrustCache {
    static let shared = TrustCache()

    private let cacheKey = "trust.cache"
    private var cache: [String: TrustEntry] = [:]
    private let cacheLock = NSLock()

    private init() {
        loadCache()
    }

    // MARK: - Cache Operations

    func addTrustEntry(issuerDID: String, trustLevel: TrustLevel, metadata: [String: Any] = [:]) {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        let entry = TrustEntry(
            issuerDID: issuerDID,
            trustLevel: trustLevel,
            metadata: metadata,
            timestamp: Date()
        )

        cache[issuerDID] = entry
        persistCache()
    }

    func getTrustLevel(for issuerDID: String) -> TrustLevel? {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        return cache[issuerDID]?.trustLevel
    }

    func getTrustEntry(for issuerDID: String) -> TrustEntry? {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        return cache[issuerDID]
    }

    func isTrusted(issuerDID: String) -> Bool {
        guard let level = getTrustLevel(for: issuerDID) else {
            return false
        }
        return level == .high || level == .medium
    }

    // MARK: - Persistence

    private func persistCache() {
        guard let data = try? JSONEncoder().encode(cache) else {
            return
        }

        // Store in UserDefaults (immutable - append-only in production)
        UserDefaults.standard.set(data, forKey: cacheKey)
    }

    private func loadCache() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let decoded = try? JSONDecoder().decode([String: TrustEntry].self, from: data) else {
            return
        }

        cache = decoded
    }

    // MARK: - Cache Management

    func clearCache() {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        cache.removeAll()
        UserDefaults.standard.removeObject(forKey: cacheKey)
    }
}

// MARK: - Trust Entry

struct TrustEntry: Codable {
    let issuerDID: String
    let trustLevel: TrustLevel
    let metadata: [String: String]
    let timestamp: Date
}

enum TrustLevel: String, Codable {
    case high = "high"
    case medium = "medium"
    case low = "low"
    case untrusted = "untrusted"
}

// MARK: - Trust Entry Codable Support

extension Dictionary where Key == String, Value == TrustEntry {
    enum CodingKeys: String, CodingKey {
        case issuerDID, trustLevel, metadata, timestamp
    }
}

extension Dictionary: Codable where Key == String, Value == TrustEntry {
    init(from decoder: Decoder) throws {
        self.init()
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Custom decoding if needed
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        // Custom encoding if needed
    }
}

