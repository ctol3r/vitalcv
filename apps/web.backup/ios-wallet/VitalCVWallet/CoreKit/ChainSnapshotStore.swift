//
//  ChainSnapshotStore.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 14
//  ChainSnapshotStore: Block info and chain snapshots
//

import Foundation

/// ChainSnapshotStore - Stores blockchain snapshots and block information
/// Caches chain state to reduce network requests
@MainActor
class ChainSnapshotStore: ObservableObject {
    static let shared = ChainSnapshotStore()

    private let cache = NSCache<NSString, ChainSnapshot>()
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let maxCacheAge: TimeInterval = 6 * 60 * 60 // 6 hours

    private init() {
        // Setup in-memory cache
        cache.countLimit = 50
        cache.totalCostLimit = 5 * 1024 * 1024 // 5 MB

        // Setup disk cache directory
        let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        cacheDirectory = documentsURL.appendingPathComponent("ChainSnapshots", isDirectory: true)

        // Create directory if needed
        if !fileManager.fileExists(atPath: cacheDirectory.path) {
            try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        }

        // Load snapshots from disk
        Task {
            await loadSnapshots()
        }
    }

    // MARK: - Public API

    /// Store chain snapshot
    func storeSnapshot(_ snapshot: ChainSnapshot) async {
        // Store in memory cache
        cache.setObject(snapshot, forKey: snapshot.blockHash as NSString)

        // Persist to disk
        await persistToDisk(snapshot)
    }

    /// Load chain snapshot by block hash
    func loadSnapshot(blockHash: String) async -> ChainSnapshot? {
        // Check memory cache first
        if let snapshot = cache.object(forKey: blockHash as NSString) {
            // Check if cache is still valid
            if Date().timeIntervalSince(snapshot.cachedAt) < maxCacheAge {
                return snapshot
            } else {
                // Remove stale entry
                cache.removeObject(forKey: blockHash as NSString)
            }
        }

        // Load from disk
        if let snapshot = await loadFromDisk(blockHash: blockHash) {
            // Check if cache is still valid
            if Date().timeIntervalSince(snapshot.cachedAt) < maxCacheAge {
                // Restore to memory cache
                cache.setObject(snapshot, forKey: blockHash as NSString)
                return snapshot
            } else {
                // Remove stale entry
                await removeFromDisk(blockHash: blockHash)
            }
        }

        return nil
    }

    /// Load latest snapshot for chain
    func loadLatestSnapshot(chainId: String) async -> ChainSnapshot? {
        let filePrefix = "\(chainId)_"

        guard let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: [.contentModificationDateKey]) else {
            return nil
        }

        // Filter snapshots for this chain
        let chainSnapshots = contents.filter { $0.lastPathComponent.hasPrefix(filePrefix) }

        // Find most recent
        var latest: (URL, Date)? = nil
        for fileURL in chainSnapshots {
            if let attributes = try? fileURL.resourceValues(forKeys: [.contentModificationDateKey]),
               let date = attributes.contentModificationDate {
                if latest == nil || date > latest!.1 {
                    latest = (fileURL, date)
                }
            }
        }

        guard let (url, _) = latest else {
            return nil
        }

        return await loadFromDisk(fileURL: url)
    }

    /// Store block information
    func storeBlockInfo(_ blockInfo: BlockInfo) async {
        let snapshot = ChainSnapshot(
            blockHash: blockInfo.hash,
            blockNumber: blockInfo.number,
            chainId: blockInfo.chainId,
            timestamp: blockInfo.timestamp,
            transactions: blockInfo.transactions,
            cachedAt: Date()
        )

        await storeSnapshot(snapshot)
    }

    /// Clear all snapshots
    func clearAll() async {
        cache.removeAllObjects()

        // Clear disk cache
        if let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) {
            for fileURL in contents {
                try? fileManager.removeItem(at: fileURL)
            }
        }
    }

    /// Clean up stale snapshots
    func cleanupStaleSnapshots() async {
        let now = Date()

        // Clean disk cache
        if let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) {
            for fileURL in contents {
                if let snapshot = await loadFromDisk(fileURL: fileURL) {
                    if now.timeIntervalSince(snapshot.cachedAt) >= maxCacheAge {
                        try? fileManager.removeItem(at: fileURL)
                        cache.removeObject(forKey: snapshot.blockHash as NSString)
                    }
                }
            }
        }
    }

    // MARK: - Disk Persistence

    private func persistToDisk(_ snapshot: ChainSnapshot) async {
        let fileName = "\(snapshot.chainId)_\(snapshot.blockHash).json"
        let fileURL = cacheDirectory.appendingPathComponent(fileName)

        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(snapshot)
            try data.write(to: fileURL)
        } catch {
            print("Failed to persist chain snapshot: \(error)")
        }
    }

    private func loadFromDisk(blockHash: String) async -> ChainSnapshot? {
        // Find file with matching block hash
        guard let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) else {
            return nil
        }

        for fileURL in contents {
            if fileURL.lastPathComponent.contains(blockHash) {
                return await loadFromDisk(fileURL: fileURL)
            }
        }

        return nil
    }

    private func loadFromDisk(fileURL: URL) async -> ChainSnapshot? {
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(ChainSnapshot.self, from: data)
        } catch {
            print("Failed to load chain snapshot: \(error)")
            return nil
        }
    }

    private func loadSnapshots() async {
        guard let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) else {
            return
        }

        for fileURL in contents where fileURL.pathExtension == "json" {
            if let snapshot = await loadFromDisk(fileURL: fileURL) {
                // Restore to memory cache if valid
                if Date().timeIntervalSince(snapshot.cachedAt) < maxCacheAge {
                    cache.setObject(snapshot, forKey: snapshot.blockHash as NSString)
                }
            }
        }
    }

    private func removeFromDisk(blockHash: String) async {
        guard let contents = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) else {
            return
        }

        for fileURL in contents {
            if fileURL.lastPathComponent.contains(blockHash) {
                try? fileManager.removeItem(at: fileURL)
            }
        }
    }
}

// MARK: - Models

class ChainSnapshot: NSObject, Codable {
    let blockHash: String
    let blockNumber: Int64
    let chainId: String
    let timestamp: Date
    let transactions: [String]
    let cachedAt: Date

    init(blockHash: String, blockNumber: Int64, chainId: String, timestamp: Date, transactions: [String], cachedAt: Date) {
        self.blockHash = blockHash
        self.blockNumber = blockNumber
        self.chainId = chainId
        self.timestamp = timestamp
        self.transactions = transactions
        self.cachedAt = cachedAt
        super.init()
    }
}

struct BlockInfo {
    let hash: String
    let number: Int64
    let chainId: String
    let timestamp: Date
    let transactions: [String]
}

