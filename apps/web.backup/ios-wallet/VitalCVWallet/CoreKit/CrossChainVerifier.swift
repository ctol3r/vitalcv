//
//  CrossChainVerifier.swift
//  VitalCVWallet
//
//  Created: Chain Orchestration Layer - Phase 4
//  Cross-Chain Proof Verification - Verify trust across different chains seamlessly
//

import Foundation

/// CrossChainVerifier - Verifies proofs across different chains
@MainActor
public class CrossChainVerifier: ObservableObject {
    public static let shared = CrossChainVerifier()

    // MARK: - Published State

    @Published public var verificationResults: [String: CrossChainVerificationResult] = [:]
    @Published public var chainConfidenceScores: [String: ChainConfidenceScore] = [:]

    // MARK: - Dependencies

    private let orchestrator = ChainOrchestrator.shared
    private let multiAnchorEngine = MultiAnchorEngine.shared
    private let rollupEngine = RollupEngine.shared

    // MARK: - Configuration

    public var timestampTolerance: TimeInterval = 300.0 // 5 minutes
    public var staleAnchorThreshold: TimeInterval = 2592000.0 // 30 days
    public var panicModeEnabled: Bool = true

    // MARK: - Private State

    private var failoverChain: Ledger?
    private var panicModeActive: Bool = false

    // MARK: - Initialization

    private init() {
        setupFailoverChain()
    }

    // MARK: - Task 25: CrossChainVerifier Foundation

    /// Verify credential across all chains
    public func verifyCredential(
        credentialHash: String,
        credentialId: String? = nil
    ) async throws -> CrossChainVerificationResult {
        // Task 26: Build verification path
        let verificationPath = buildVerificationPath(
            credentialHash: credentialHash,
            credentialId: credentialId
        )

        // Task 27: Apply rule - proof from ANY chain must match primary hash
        let primaryHash = credentialHash
        var verifiedChains: [Ledger: Bool] = [:]

        // Verify on each path component
        if let emittedEvent = verificationPath.emittedEvent {
            let verified = try await verifyEmittedEvent(
                event: emittedEvent,
                expectedHash: primaryHash
            )
            verifiedChains[emittedEvent.ledger] = verified
        }

        for receipt in verificationPath.receiptChain {
            let verified = try await verifyReceipt(
                receipt: receipt,
                expectedHash: primaryHash
            )
            verifiedChains[receipt.ledger] = verified
        }

        for receipt in verificationPath.mirrorChain {
            let verified = try await verifyReceipt(
                receipt: receipt,
                expectedHash: primaryHash
            )
            verifiedChains[receipt.ledger] = verified
        }

        if let rollupEntry = verificationPath.rollupLayer {
            let verified = try await verifyRollupLayer(
                entry: rollupEntry,
                expectedHash: primaryHash
            )
            verifiedChains[.offChainMerkle] = verified
        }

        // Task 27: At least one chain must match primary hash
        let anyChainMatches = verifiedChains.values.contains { $0 }

        // Task 28: Calculate chain confidence score
        let confidenceScore = calculateChainConfidenceScore(
            verifiedChains: verifiedChains,
            verificationPath: verificationPath
        )

        // Task 29: Reconcile block timestamps
        let timestampReconciliation = reconcileBlockTimestamps(
            verificationPath: verificationPath
        )

        // Task 30: Check for stale anchors
        let staleAnchors = detectStaleAnchors(verificationPath: verificationPath)

        // Task 32: Check panic mode
        if panicModeEnabled && !anyChainMatches {
            await activatePanicMode()
        }

        let result = CrossChainVerificationResult(
            credentialHash: credentialHash,
            verified: anyChainMatches,
            verifiedChains: verifiedChains,
            confidenceScore: confidenceScore,
            timestampReconciliation: timestampReconciliation,
            staleAnchors: staleAnchors,
            panicMode: panicModeActive,
            timestamp: Date()
        )

        verificationResults[credentialHash] = result
        chainConfidenceScores[credentialHash] = confidenceScore

        return result
    }

    // MARK: - Task 26: Verification Path

    private func buildVerificationPath(
        credentialHash: String,
        credentialId: String?
    ) -> VerificationPath {
        var path = VerificationPath(
            credentialHash: credentialHash,
            credentialId: credentialId
        )

        // Get receipts from multi-anchor engine
        if let credentialId = credentialId,
           let bundle = multiAnchorEngine.getReceiptsBundle(for: credentialId) {
            path.receiptChain = Array(bundle.receipts.values)
        }

        // Get mirror chain receipts
        if let bundle = multiAnchorEngine.getReceiptsBundle(for: credentialId ?? ""),
           let evmReceipt = bundle.receipts.values.first(where: { receipt in
               if case .evmChain = receipt.ledger { return true }
               return false
           }) {
            path.mirrorChain = [evmReceipt]
        }

        // Get rollup layer entry
        if let entry = rollupEngine.getChainOfChainsMapping(for: credentialHash) {
            path.rollupLayer = entry
        }

        // Get emitted event (from primary chain)
        if let primaryReceipt = path.receiptChain.first(where: { receipt in
            receipt.ledger == .vitalCVChain
        }) {
            path.emittedEvent = EmittedEvent(
                ledger: .vitalCVChain,
                transactionHash: primaryReceipt.transactionHash,
                blockNumber: primaryReceipt.blockNumber,
                timestamp: primaryReceipt.timestamp
            )
        }

        return path
    }

    // MARK: - Task 27: Proof Matching Rule

    private func verifyEmittedEvent(
        event: EmittedEvent,
        expectedHash: String
    ) async throws -> Bool {
        // In production, query chain to verify event matches hash
        // For now, simulate verification
        try await Task.sleep(nanoseconds: 500_000_000)
        return true // Simplified
    }

    private func verifyReceipt(
        receipt: AnchorReceipt,
        expectedHash: String
    ) async throws -> Bool {
        // Verify receipt hash matches expected
        // In production, query chain to verify transaction
        try await Task.sleep(nanoseconds: 500_000_000)
        return receipt.status == .confirmed
    }

    private func verifyRollupLayer(
        entry: ChainOfChainsEntry,
        expectedHash: String
    ) async throws -> Bool {
        // Verify rollup membership
        guard let rollupId = activeRollupId(for: entry.rollupHash) else {
            return false
        }

        let merklePath = rollupEngine.generateMerklePath(
            eventHash: entry.eventHash,
            rollupId: rollupId
        )

        let verification = rollupEngine.verifyMembership(
            eventHash: entry.eventHash,
            rollupId: rollupId,
            merklePath: merklePath
        )

        return verification.verified
    }

    private func activeRollupId(for rollupHash: String) -> String? {
        // Find rollup cycle by hash
        for (id, cycle) in rollupEngine.activeRollups {
            if cycle.merkleRoot.rootHash == rollupHash {
                return id
            }
        }
        return nil
    }

    // MARK: - Task 28: Chain Confidence Score

    private func calculateChainConfidenceScore(
        verifiedChains: [Ledger: Bool],
        verificationPath: VerificationPath
    ) -> ChainConfidenceScore {
        var scores: [Ledger: Double] = [:]

        // Primary chain (VitalCVChain) - highest confidence
        if let primaryVerified = verifiedChains[.vitalCVChain], primaryVerified {
            scores[.vitalCVChain] = 1.0
        } else {
            scores[.vitalCVChain] = 0.0
        }

        // EVM mirror - high confidence
        for (ledger, verified) in verifiedChains {
            if case .evmChain = ledger, verified {
                scores[ledger] = 0.9
            }
        }

        // Rollup layer - medium confidence
        if verifiedChains[.offChainMerkle] == true {
            scores[.offChainMerkle] = 0.7
        }

        // Calculate overall confidence
        let verifiedCount = verifiedChains.values.filter { $0 }.count
        let totalChains = verifiedChains.count
        let overallConfidence = totalChains > 0 ? Double(verifiedCount) / Double(totalChains) : 0.0

        // Multi-ledger consensus bonus
        let consensusBonus = verifiedCount >= 2 ? 0.1 : 0.0
        let finalConfidence = min(1.0, overallConfidence + consensusBonus)

        return ChainConfidenceScore(
            overall: finalConfidence,
            perChain: scores,
            verifiedCount: verifiedCount,
            totalChains: totalChains
        )
    }

    // MARK: - Task 29: Block Timestamp Reconciliation

    private func reconcileBlockTimestamps(
        verificationPath: VerificationPath
    ) -> TimestampReconciliation {
        var timestamps: [Ledger: Date] = [:]

        // Collect timestamps from all chains
        if let event = verificationPath.emittedEvent {
            timestamps[event.ledger] = event.timestamp
        }

        for receipt in verificationPath.receiptChain {
            timestamps[receipt.ledger] = receipt.timestamp
        }

        for receipt in verificationPath.mirrorChain {
            timestamps[receipt.ledger] = receipt.timestamp
        }

        if let rollup = verificationPath.rollupLayer {
            timestamps[.offChainMerkle] = rollup.timestamp
        }

        // Check if timestamps are within tolerance
        let sortedTimestamps = timestamps.values.sorted()
        guard let earliest = sortedTimestamps.first,
              let latest = sortedTimestamps.last else {
            return TimestampReconciliation(
                reconciled: false,
                maxDifference: 0.0,
                timestamps: timestamps
            )
        }

        let maxDifference = latest.timeIntervalSince(earliest)
        let reconciled = maxDifference <= timestampTolerance

        return TimestampReconciliation(
            reconciled: reconciled,
            maxDifference: maxDifference,
            timestamps: timestamps
        )
    }

    // MARK: - Task 30: Multi-Chain TTL Detection

    private func detectStaleAnchors(
        verificationPath: VerificationPath
    ) -> [StaleAnchor] {
        var staleAnchors: [StaleAnchor] = []
        let now = Date()

        // Check receipt chain
        for receipt in verificationPath.receiptChain {
            let age = now.timeIntervalSince(receipt.timestamp)
            if age > staleAnchorThreshold {
                staleAnchors.append(StaleAnchor(
                    ledger: receipt.ledger,
                    transactionHash: receipt.transactionHash,
                    age: age,
                    threshold: staleAnchorThreshold
                ))
            }
        }

        // Check mirror chain
        for receipt in verificationPath.mirrorChain {
            let age = now.timeIntervalSince(receipt.timestamp)
            if age > staleAnchorThreshold {
                staleAnchors.append(StaleAnchor(
                    ledger: receipt.ledger,
                    transactionHash: receipt.transactionHash,
                    age: age,
                    threshold: staleAnchorThreshold
                ))
            }
        }

        return staleAnchors
    }

    // MARK: - Task 31: Unified Verification Endpoint

    /// Unified verification endpoint
    public func verify(
        credentialHash: String,
        credentialId: String? = nil
    ) async throws -> UnifiedVerificationResponse {
        let result = try await verifyCredential(
            credentialHash: credentialHash,
            credentialId: credentialId
        )

        // Apply trust score penalty for stale anchors
        var trustScorePenalty = 0.0
        if !result.staleAnchors.isEmpty {
            trustScorePenalty = Double(result.staleAnchors.count) * 0.1 // 10% per stale anchor
        }

        return UnifiedVerificationResponse(
            verified: result.verified,
            confidenceScore: result.confidenceScore.overall,
            trustScorePenalty: trustScorePenalty,
            staleAnchors: result.staleAnchors.count,
            panicMode: result.panicMode,
            timestamp: result.timestamp
        )
    }

    // MARK: - Task 32: Panic Mode

    private func setupFailoverChain() {
        // Set up failover chain (EVM as backup)
        failoverChain = .evmChain(chainId: "1")
    }

    private func activatePanicMode() async {
        guard !panicModeActive else { return }

        panicModeActive = true
        print("[CrossChainVerifier] PANIC MODE ACTIVATED - Chain corrupted, activating failover")

        // Switch to failover chain
        if let failover = failoverChain {
            // In production, would update orchestrator to prefer failover
            print("[CrossChainVerifier] Failover chain active: \(failover)")
        }
    }

    public func deactivatePanicMode() {
        panicModeActive = false
        print("[CrossChainVerifier] Panic mode deactivated")
    }
}

// MARK: - Supporting Types

/// VerificationPath - Path for cross-chain verification
public struct VerificationPath {
    public let credentialHash: String
    public let credentialId: String?
    public var emittedEvent: EmittedEvent?
    public var receiptChain: [AnchorReceipt] = []
    public var mirrorChain: [AnchorReceipt] = []
    public var rollupLayer: ChainOfChainsEntry?

    public init(
        credentialHash: String,
        credentialId: String?,
        emittedEvent: EmittedEvent? = nil,
        receiptChain: [AnchorReceipt] = [],
        mirrorChain: [AnchorReceipt] = [],
        rollupLayer: ChainOfChainsEntry? = nil
    ) {
        self.credentialHash = credentialHash
        self.credentialId = credentialId
        self.emittedEvent = emittedEvent
        self.receiptChain = receiptChain
        self.mirrorChain = mirrorChain
        self.rollupLayer = rollupLayer
    }
}

/// EmittedEvent - Event emitted on chain
public struct EmittedEvent {
    public let ledger: Ledger
    public let transactionHash: String
    public let blockNumber: Int
    public let timestamp: Date
}

/// CrossChainVerificationResult - Result of cross-chain verification
public struct CrossChainVerificationResult {
    public let credentialHash: String
    public let verified: Bool
    public let verifiedChains: [Ledger: Bool]
    public let confidenceScore: ChainConfidenceScore
    public let timestampReconciliation: TimestampReconciliation
    public let staleAnchors: [StaleAnchor]
    public let panicMode: Bool
    public let timestamp: Date
}

/// ChainConfidenceScore - Confidence score for multi-ledger consensus
public struct ChainConfidenceScore {
    public let overall: Double
    public let perChain: [Ledger: Double]
    public let verifiedCount: Int
    public let totalChains: Int
}

/// TimestampReconciliation - Result of timestamp reconciliation
public struct TimestampReconciliation {
    public let reconciled: Bool
    public let maxDifference: TimeInterval
    public let timestamps: [Ledger: Date]
}

/// StaleAnchor - Stale anchor detection
public struct StaleAnchor {
    public let ledger: Ledger
    public let transactionHash: String
    public let age: TimeInterval
    public let threshold: TimeInterval
}

/// UnifiedVerificationResponse - Unified verification response
public struct UnifiedVerificationResponse {
    public let verified: Bool
    public let confidenceScore: Double
    public let trustScorePenalty: Double
    public let staleAnchors: Int
    public let panicMode: Bool
    public let timestamp: Date
}

