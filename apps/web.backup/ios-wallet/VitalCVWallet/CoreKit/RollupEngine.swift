//
//  RollupEngine.swift
//  VitalCVWallet
//
//  Created: Chain Orchestration Layer - Phase 3
//  Rollup Layer + Batch Proofing - Lightweight L2 "trust rollup"
//

import Foundation
import CryptoKit

/// RollupEngine - Off-chain Merkle accumulator for batch anchoring
@MainActor
public class RollupEngine: ObservableObject {
    public static let shared = RollupEngine()

    // MARK: - Published State

    @Published public var activeRollups: [String: RollupCycle] = [:]
    @Published public var merkleRoots: [String: MerkleRoot] = [:]
    @Published public var chainOfChainsMapping: [String: ChainOfChainsEntry] = [:]

    // MARK: - Dependencies

    private let orchestrator = ChainOrchestrator.shared

    // MARK: - Configuration

    public var rollupCycleInterval: TimeInterval = 3600.0 // 1 hour (hourly)
    public var dailyRollupTime: DateComponents = DateComponents(hour: 0, minute: 0) // Midnight
    public var maxEventsPerRollup: Int = 1000

    // MARK: - Private State

    private var rollupTask: Task<Void, Never>?
    private var eventAccumulator: [CredentialEvent] = []
    private let accumulatorLock = NSLock()

    // MARK: - Initialization

    private init() {
        startRollupCycles()
    }

    // MARK: - Task 17: RollupEngine Foundation

    /// Add credential event to rollup accumulator
    public func addCredentialEvent(_ event: CredentialEvent) {
        accumulatorLock.lock()
        defer { accumulatorLock.unlock() }

        eventAccumulator.append(event)

        // If accumulator is full, trigger immediate rollup
        if eventAccumulator.count >= maxEventsPerRollup {
            Task {
                await processRollupCycle()
            }
        }
    }

    // MARK: - Task 18: Rollup Cycles

    private func startRollupCycles() {
        rollupTask = Task { [weak self] in
            while !Task.isCancelled {
                // Hourly rollup
                await self?.processRollupCycle()
                try? await Task.sleep(nanoseconds: UInt64((self?.rollupCycleInterval ?? 3600.0) * 1_000_000_000))
            }
        }

        // Also schedule daily rollup
        scheduleDailyRollup()
    }

    private func scheduleDailyRollup() {
        // Schedule daily rollup at midnight
        // In production, use proper scheduling
        Task {
            while !Task.isCancelled {
                let now = Date()
                let calendar = Calendar.current
                let tomorrow = calendar.date(byAdding: .day, value: 1, to: now)!
                let midnight = calendar.startOfDay(for: tomorrow)

                let timeUntilMidnight = midnight.timeIntervalSince(now)
                try? await Task.sleep(nanoseconds: UInt64(timeUntilMidnight * 1_000_000_000))

                await processDailyRollup()
            }
        }
    }

    private func processRollupCycle() async {
        accumulatorLock.lock()
        let events = eventAccumulator
        eventAccumulator.removeAll()
        accumulatorLock.unlock()

        guard !events.isEmpty else { return }

        // Task 19: Build Merkle root
        let merkleRoot = buildMerkleRoot(for: events)

        // Create rollup cycle
        let cycle = RollupCycle(
            id: UUID().uuidString,
            events: events,
            merkleRoot: merkleRoot,
            timestamp: Date(),
            cycleType: .hourly
        )

        activeRollups[cycle.id] = cycle
        merkleRoots[cycle.id] = merkleRoot

        // Task 20: Batch anchor submission to primary ledger
        await submitBatchAnchor(cycle: cycle)

        // Task 21: Create chain-of-chains mapping
        createChainOfChainsMapping(cycle: cycle)
    }

    private func processDailyRollup() async {
        accumulatorLock.lock()
        let events = eventAccumulator
        eventAccumulator.removeAll()
        accumulatorLock.unlock()

        guard !events.isEmpty else { return }

        let merkleRoot = buildMerkleRoot(for: events)

        let cycle = RollupCycle(
            id: UUID().uuidString,
            events: events,
            merkleRoot: merkleRoot,
            timestamp: Date(),
            cycleType: .daily
        )

        activeRollups[cycle.id] = cycle
        merkleRoots[cycle.id] = merkleRoot

        await submitBatchAnchor(cycle: cycle)
        createChainOfChainsMapping(cycle: cycle)
    }

    // MARK: - Task 19: Merkle Root Builder

    private func buildMerkleRoot(for events: [CredentialEvent]) -> MerkleRoot {
        // Build Merkle tree from events
        let leaves = events.map { event in
            hashEvent(event)
        }

        // Build Merkle tree
        let rootHash = buildMerkleTree(leaves: leaves)

        return MerkleRoot(
            rootHash: rootHash,
            eventCount: events.count,
            timestamp: Date()
        )
    }

    private func hashEvent(_ event: CredentialEvent) -> String {
        let data = "\(event.eventHash)\(event.timestamp.timeIntervalSince1970)".data(using: .utf8)!
        let digest = SHA256.hash(data: data)
        return "0x\(digest.map { String(format: "%02x", $0) }.joined())"
    }

    private func buildMerkleTree(leaves: [String]) -> String {
        guard !leaves.isEmpty else {
            return "0x" + String(repeating: "0", count: 64)
        }

        var currentLevel = leaves

        while currentLevel.count > 1 {
            var nextLevel: [String] = []

            for i in stride(from: 0, to: currentLevel.count, by: 2) {
                if i + 1 < currentLevel.count {
                    // Pair exists, hash together
                    let combined = currentLevel[i] + currentLevel[i + 1]
                    let data = combined.data(using: .utf8)!
                    let digest = SHA256.hash(data: data)
                    nextLevel.append("0x\(digest.map { String(format: "%02x", $0) }.joined())")
                } else {
                    // Odd node, hash with itself
                    let combined = currentLevel[i] + currentLevel[i]
                    let data = combined.data(using: .utf8)!
                    let digest = SHA256.hash(data: data)
                    nextLevel.append("0x\(digest.map { String(format: "%02x", $0) }.joined())")
                }
            }

            currentLevel = nextLevel
        }

        return currentLevel[0]
    }

    // MARK: - Task 20: Batch Anchor Submission

    private func submitBatchAnchor(cycle: RollupCycle) async {
        // Submit rollup Merkle root to primary ledger
        let request = orchestrator.createAnchorRequest(
            credentialId: cycle.id,
            credentialHash: cycle.merkleRoot.rootHash,
            metadata: [
                "rollupType": cycle.cycleType.rawValue,
                "eventCount": cycle.events.count
            ]
        )

        do {
            let response = try await orchestrator.routeAnchorRequest(request)

            // Store anchor hash
            if let primaryReceipt = response.receipts[.vitalCVChain] {
                cycle.anchorHash = primaryReceipt.transactionHash
                cycle.anchorBlockNumber = primaryReceipt.blockNumber
            }
        } catch {
            print("[RollupEngine] Failed to submit batch anchor: \(error)")
        }
    }

    // MARK: - Task 21: Chain-of-Chains Mapping

    private func createChainOfChainsMapping(cycle: RollupCycle) {
        // Map: eventHash → rollupHash → anchorHash
        for event in cycle.events {
            let entry = ChainOfChainsEntry(
                eventHash: event.eventHash,
                rollupHash: cycle.merkleRoot.rootHash,
                anchorHash: cycle.anchorHash,
                rollupId: cycle.id,
                timestamp: Date()
            )

            chainOfChainsMapping[event.eventHash] = entry
        }
    }

    /// Get chain-of-chains mapping for event hash
    public func getChainOfChainsMapping(for eventHash: String) -> ChainOfChainsEntry? {
        return chainOfChainsMapping[eventHash]
    }

    // MARK: - Task 22: ZK-Proof Placeholder

    /// Generate ZK-proof placeholder for rollup membership
    public func generateZKProofPlaceholder(
        eventHash: String,
        rollupId: String
    ) -> ZKProofPlaceholder {
        // In production, this would generate an actual ZK-proof
        // For now, return placeholder
        return ZKProofPlaceholder(
            eventHash: eventHash,
            rollupId: rollupId,
            merklePath: generateMerklePath(eventHash: eventHash, rollupId: rollupId),
            proof: "zk-proof-placeholder",
            timestamp: Date()
        )
    }

    public func generateMerklePath(eventHash: String, rollupId: String) -> [String] {
        // Generate Merkle path for proving membership
        // In production, this would be the actual path from leaf to root
        guard let cycle = activeRollups[rollupId] else {
            return []
        }

        // Find event in cycle
        guard let eventIndex = cycle.events.firstIndex(where: { $0.eventHash == eventHash }) else {
            return []
        }

        // Build path (simplified - in production would be actual Merkle path)
        var path: [String] = []
        let leaves = cycle.events.map { hashEvent($0) }
        var currentIndex = eventIndex

        // Build path up to root
        var currentLevel = leaves
        while currentLevel.count > 1 {
            let siblingIndex = currentIndex % 2 == 0 ? currentIndex + 1 : currentIndex - 1
            if siblingIndex < currentLevel.count {
                path.append(currentLevel[siblingIndex])
            }
            currentIndex = currentIndex / 2
            // In production, would rebuild level properly
            break // Simplified
        }

        return path
    }

    // MARK: - Task 23: Audit API - Verify Membership

    /// Verify membership in rollup via Merkle proof
    public func verifyMembership(
        eventHash: String,
        rollupId: String,
        merklePath: [String]
    ) -> MembershipVerificationResult {
        guard let cycle = activeRollups[rollupId] else {
            return MembershipVerificationResult(
                verified: false,
                error: "Rollup cycle not found"
            )
        }

        guard let event = cycle.events.first(where: { $0.eventHash == eventHash }) else {
            return MembershipVerificationResult(
                verified: false,
                error: "Event not found in rollup"
            )
        }

        // Verify Merkle path
        let leafHash = hashEvent(event)
        let verified = verifyMerklePath(
            leafHash: leafHash,
            path: merklePath,
            rootHash: cycle.merkleRoot.rootHash
        )

        return MembershipVerificationResult(
            verified: verified,
            error: verified ? nil : "Merkle path verification failed"
        )
    }

    private func verifyMerklePath(
        leafHash: String,
        path: [String],
        rootHash: String
    ) -> Bool {
        var currentHash = leafHash

        for sibling in path {
            // Combine with sibling and hash
            let combined = currentHash + sibling
            let data = combined.data(using: .utf8)!
            let digest = SHA256.hash(data: data)
            currentHash = "0x\(digest.map { String(format: "%02x", $0) }.joined())"
        }

        return currentHash == rootHash
    }

    // MARK: - Task 24: Offline Proof-of-Inclusion

    /// Generate offline proof-of-inclusion via Merkle path
    public func generateOfflineProof(
        eventHash: String,
        rollupId: String
    ) -> OfflineProof? {
        guard let entry = chainOfChainsMapping[eventHash] else {
            return nil
        }

        guard let cycle = activeRollups[rollupId] else {
            return nil
        }

        // Generate Merkle path
        let merklePath = generateMerklePath(eventHash: eventHash, rollupId: rollupId)

        return OfflineProof(
            eventHash: eventHash,
            rollupHash: entry.rollupHash,
            anchorHash: entry.anchorHash,
            merklePath: merklePath,
            rollupId: rollupId,
            timestamp: Date()
        )
    }
}

// MARK: - Supporting Types

/// RollupCycle - A rollup cycle (hourly or daily)
public class RollupCycle: Identifiable, Codable {
    public let id: String
    public let events: [CredentialEvent]
    public let merkleRoot: MerkleRoot
    public let timestamp: Date
    public let cycleType: RollupCycleType
    public var anchorHash: String?
    public var anchorBlockNumber: Int?

    public init(
        id: String,
        events: [CredentialEvent],
        merkleRoot: MerkleRoot,
        timestamp: Date,
        cycleType: RollupCycleType,
        anchorHash: String? = nil,
        anchorBlockNumber: Int? = nil
    ) {
        self.id = id
        self.events = events
        self.merkleRoot = merkleRoot
        self.timestamp = timestamp
        self.cycleType = cycleType
        self.anchorHash = anchorHash
        self.anchorBlockNumber = anchorBlockNumber
    }
}

/// RollupCycleType - Type of rollup cycle
public enum RollupCycleType: String, Codable {
    case hourly
    case daily
}

/// CredentialEvent - Event to be included in rollup
public struct CredentialEvent: Identifiable, Codable {
    public let id = UUID()
    public let eventHash: String
    public let credentialId: String
    public let eventType: CredentialEventType
    public let timestamp: Date
    public let metadata: [String: Any]?

    public init(
        eventHash: String,
        credentialId: String,
        eventType: CredentialEventType,
        timestamp: Date,
        metadata: [String: Any]? = nil
    ) {
        self.eventHash = eventHash
        self.credentialId = credentialId
        self.eventType = eventType
        self.timestamp = timestamp
        self.metadata = metadata
    }

    // Custom Codable for metadata
    enum CodingKeys: String, CodingKey {
        case eventHash, credentialId, eventType, timestamp
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        eventHash = try container.decode(String.self, forKey: .eventHash)
        credentialId = try container.decode(String.self, forKey: .credentialId)
        eventType = try container.decode(CredentialEventType.self, forKey: .eventType)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        metadata = nil
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(eventHash, forKey: .eventHash)
        try container.encode(credentialId, forKey: .credentialId)
        try container.encode(eventType, forKey: .eventType)
        try container.encode(timestamp, forKey: .timestamp)
    }
}

/// CredentialEventType - Type of credential event
public enum CredentialEventType: String, Codable {
    case issued
    case verified
    case revoked
    case updated
}

/// MerkleRoot - Merkle root of rollup
public struct MerkleRoot: Codable {
    public let rootHash: String
    public let eventCount: Int
    public let timestamp: Date

    public init(
        rootHash: String,
        eventCount: Int,
        timestamp: Date
    ) {
        self.rootHash = rootHash
        self.eventCount = eventCount
        self.timestamp = timestamp
    }
}

/// ChainOfChainsEntry - Mapping entry for chain-of-chains
public struct ChainOfChainsEntry: Codable {
    public let eventHash: String
    public let rollupHash: String
    public let anchorHash: String?
    public let rollupId: String
    public let timestamp: Date

    public init(
        eventHash: String,
        rollupHash: String,
        anchorHash: String?,
        rollupId: String,
        timestamp: Date
    ) {
        self.eventHash = eventHash
        self.rollupHash = rollupHash
        self.anchorHash = anchorHash
        self.rollupId = rollupId
        self.timestamp = timestamp
    }
}

/// ZKProofPlaceholder - Placeholder for ZK-proof
public struct ZKProofPlaceholder: Codable {
    public let eventHash: String
    public let rollupId: String
    public let merklePath: [String]
    public let proof: String
    public let timestamp: Date
}

/// MembershipVerificationResult - Result of membership verification
public struct MembershipVerificationResult {
    public let verified: Bool
    public let error: String?
}

/// OfflineProof - Offline proof-of-inclusion
public struct OfflineProof: Codable {
    public let eventHash: String
    public let rollupHash: String
    public let anchorHash: String?
    public let merklePath: [String]
    public let rollupId: String
    public let timestamp: Date
}

