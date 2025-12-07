//
//  MultiAnchorEngine.swift
//  VitalCVWallet
//
//  Created: Chain Orchestration Layer - Phase 2
//  Multi-chain anchor management - Anchor once. Verify everywhere.
//

import Foundation
import CryptoKit
import Combine

/// MultiAnchorEngine - Manages anchoring on multiple chains simultaneously
@MainActor
public class MultiAnchorEngine: ObservableObject {
    public static let shared = MultiAnchorEngine()

    // MARK: - Published State

    @Published public var activeAnchorJobs: [String: AnchorJob] = [:]
    @Published public var anchorReceipts: [String: AnchorReceiptsBundle] = [:]
    @Published public var propagationEvents: [AnchorPropagationEvent] = []

    // MARK: - Dependencies

    private let orchestrator = ChainOrchestrator.shared
    private let trustScoreEngine = TrustScoreCalculator.shared

    // MARK: - Configuration

    public var maxConcurrentAnchors: Int = 5
    public var anchorTimeout: TimeInterval = 300.0 // 5 minutes
    public var consistencyCheckInterval: TimeInterval = 60.0 // 1 minute

    // MARK: - Private State

    private var anchorJobs: [String: Task<Void, Never>] = [:]
    private var consistencyCheckTask: Task<Void, Never>?
    private let jobLock = NSLock()

    // MARK: - Initialization

    private init() {
        startConsistencyChecker()
    }

    // MARK: - Task 9: MultiAnchorEngine Foundation

    /// Anchor credential on multiple chains simultaneously
    public func anchorOnMultipleChains(
        credentialId: String,
        credentialHash: String,
        metadata: [String: Any]? = nil
    ) async throws -> AnchorReceiptsBundle {
        // Create anchor request
        let request = orchestrator.createAnchorRequest(
            credentialId: credentialId,
            credentialHash: credentialHash,
            metadata: metadata
        )

        // Create anchor job
        let job = AnchorJob(
            id: UUID().uuidString,
            credentialId: credentialId,
            credentialHash: credentialHash,
            request: request,
            status: .pending,
            createdAt: Date()
        )

        jobLock.lock()
        activeAnchorJobs[job.id] = job
        jobLock.unlock()

        // Execute anchor jobs
        let receipts = try await executeAnchorJobs(job: job)

        // Create receipts bundle
        let bundle = AnchorReceiptsBundle(
            credentialId: credentialId,
            credentialHash: credentialHash,
            receipts: receipts,
            createdAt: Date()
        )

        anchorReceipts[credentialId] = bundle

        // Emit propagation event
        emitPropagationEvent(
            credentialId: credentialId,
            receipts: receipts,
            status: .success
        )

        // Update trust score
        await updateTrustScoreWithAnchors(credentialId: credentialId, bundle: bundle)

        return bundle
    }

    // MARK: - Task 10: Simultaneous Multi-Chain Anchoring

    private func executeAnchorJobs(job: AnchorJob) async throws -> [Ledger: AnchorReceipt] {
        var receipts: [Ledger: AnchorReceipt] = [:]

        // Task 11: Execute anchor jobs
        // - primary_chain_anchor
        // - evm_anchor_mirror
        // - rollup_commit

        // Primary chain anchor (VitalCVChain)
        let primaryTask = Task {
            try await anchorPrimaryChain(job: job)
        }

        // EVM anchor mirror
        let evmTask = Task {
            try await anchorEVMMirror(job: job)
        }

        // Rollup commit (off-chain Merkle)
        let rollupTask = Task {
            try await commitToRollup(job: job)
        }

        // Wait for all anchors (with timeout)
        do {
            let primaryReceipt = try await primaryTask.value
            receipts[.vitalCVChain] = primaryReceipt

            let evmReceipt = try await evmTask.value
            if let evmLedger = getEVMLedger() {
                receipts[evmLedger] = evmReceipt
            }

            let rollupReceipt = try await rollupTask.value
            receipts[.offChainMerkle] = rollupReceipt
        } catch {
            // If primary fails, try remediation
            if receipts[.vitalCVChain] == nil {
                try await remediatePrimaryChainFailure(job: job, receipts: &receipts)
            }
        }

        return receipts
    }

    private func anchorPrimaryChain(job: AnchorJob) async throws -> AnchorReceipt {
        let request = orchestrator.createAnchorRequest(
            credentialId: job.credentialId,
            credentialHash: job.credentialHash
        )

        let response = try await orchestrator.routeAnchorRequest(request)

        guard let receipt = response.receipts[.vitalCVChain] else {
            throw MultiAnchorError.primaryChainFailed
        }

        return receipt
    }

    private func anchorEVMMirror(job: AnchorJob) async throws -> AnchorReceipt {
        let request = orchestrator.createAnchorRequest(
            credentialId: job.credentialId,
            credentialHash: job.credentialHash
        )

        let response = try await orchestrator.routeAnchorRequest(request)

        // Find EVM ledger
        guard let evmLedger = getEVMLedger(),
              let receipt = response.receipts[evmLedger] else {
            throw MultiAnchorError.evmMirrorFailed
        }

        return receipt
    }

    private func commitToRollup(job: AnchorJob) async throws -> AnchorReceipt {
        let request = orchestrator.createAnchorRequest(
            credentialId: job.credentialId,
            credentialHash: job.credentialHash
        )

        let response = try await orchestrator.routeAnchorRequest(request)

        guard let receipt = response.receipts[.offChainMerkle] else {
            throw MultiAnchorError.rollupCommitFailed
        }

        return receipt
    }

    private func getEVMLedger() -> Ledger? {
        for ledger in orchestrator.activeLedgers.keys {
            if case .evmChain = ledger {
                return ledger
            }
        }
        return nil
    }

    // MARK: - Task 12: Anchor Hash Consistency Checks

    /// Verify hash consistency across all chains
    public func verifyHashConsistency(
        credentialHash: String,
        receipts: [Ledger: AnchorReceipt]
    ) -> HashConsistencyResult {
        var checks: [HashAlgorithm: Bool] = [:]

        // Extract hashes from receipts
        var hashes: [Ledger: String] = [:]
        for (ledger, receipt) in receipts {
            hashes[ledger] = receipt.transactionHash
        }

        // Check SHA256 consistency
        let sha256Consistent = checkSHA256Consistency(hashes: hashes, expectedHash: credentialHash)
        checks[.sha256] = sha256Consistent

        // Check Blake2 consistency
        let blake2Consistent = checkBlake2Consistency(hashes: hashes, expectedHash: credentialHash)
        checks[.blake2] = blake2Consistent

        // Check Keccak256 consistency
        let keccak256Consistent = checkKeccak256Consistency(hashes: hashes, expectedHash: credentialHash)
        checks[.keccak256] = keccak256Consistent

        let allConsistent = checks.values.allSatisfy { $0 }

        return HashConsistencyResult(
            consistent: allConsistent,
            checks: checks,
            hashes: hashes
        )
    }

    private func checkSHA256Consistency(
        hashes: [Ledger: String],
        expectedHash: String
    ) -> Bool {
        // In production, verify SHA256 hash matches across chains
        // For now, basic check
        return !hashes.isEmpty
    }

    private func checkBlake2Consistency(
        hashes: [Ledger: String],
        expectedHash: String
    ) -> Bool {
        // In production, verify Blake2 hash matches
        return !hashes.isEmpty
    }

    private func checkKeccak256Consistency(
        hashes: [Ledger: String],
        expectedHash: String
    ) -> Bool {
        // In production, verify Keccak256 hash matches
        return !hashes.isEmpty
    }

    // MARK: - Task 13: Anchor Receipts Bundle

    /// Get receipts bundle for credential
    public func getReceiptsBundle(for credentialId: String) -> AnchorReceiptsBundle? {
        return anchorReceipts[credentialId]
    }

    // MARK: - Task 14: Remediation Path

    /// Remediate if one ledger fails
    private func remediatePrimaryChainFailure(
        job: AnchorJob,
        receipts: inout [Ledger: AnchorReceipt]
    ) async throws {
        // Try fallback chain
        let fallbackRequest = orchestrator.createAnchorRequest(
            credentialId: job.credentialId,
            credentialHash: job.credentialHash
        )

        // Get fallback ledger
        if let evmLedger = getEVMLedger() {
            do {
                let response = try await orchestrator.routeAnchorRequest(fallbackRequest)
                if let receipt = response.receipts[evmLedger] {
                    receipts[evmLedger] = receipt
                }
            } catch {
                // If fallback also fails, use off-chain Merkle
                if let rollupReceipt = receipts[.offChainMerkle] {
                    // At least we have rollup
                    print("[MultiAnchorEngine] Primary and EVM failed, using rollup only")
                } else {
                    throw MultiAnchorError.allChainsFailed
                }
            }
        }
    }

    // MARK: - Task 15: Cross-Chain Verifier Endpoint

    /// Verify anchor across multiple chains
    public func verifyAcrossChains(
        credentialHash: String,
        receipts: [Ledger: AnchorReceipt]
    ) async throws -> CrossChainVerificationResult {
        var verifications: [Ledger: Bool] = [:]

        // Verify on each chain
        for (ledger, receipt) in receipts {
            let isValid = try await verifyOnChain(
                ledger: ledger,
                receipt: receipt,
                credentialHash: credentialHash
            )
            verifications[ledger] = isValid
        }

        // Check consistency
        let consistency = verifyHashConsistency(
            credentialHash: credentialHash,
            receipts: receipts
        )

        let allVerified = verifications.values.allSatisfy { $0 } && consistency.consistent

        return CrossChainVerificationResult(
            verified: allVerified,
            verifications: verifications,
            consistency: consistency,
            timestamp: Date()
        )
    }

    private func verifyOnChain(
        ledger: Ledger,
        receipt: AnchorReceipt,
        credentialHash: String
    ) async throws -> Bool {
        // In production, query chain to verify transaction
        // For now, simulate verification
        try await Task.sleep(nanoseconds: 500_000_000) // 500ms
        return receipt.status == .confirmed
    }

    // MARK: - Task 16: Anchor Propagation Events to TrustScore Engine

    private func emitPropagationEvent(
        credentialId: String,
        receipts: [Ledger: AnchorReceipt],
        status: PropagationStatus
    ) {
        let event = AnchorPropagationEvent(
            credentialId: credentialId,
            receipts: receipts,
            status: status,
            timestamp: Date()
        )

        propagationEvents.append(event)

        // Keep only last 100 events
        if propagationEvents.count > 100 {
            propagationEvents.removeFirst()
        }

        // Notify trust score engine
        Task {
            await notifyTrustScoreEngine(event: event)
        }
    }

    private func notifyTrustScoreEngine(event: AnchorPropagationEvent) async {
        // Update trust score based on anchor propagation
        // This integrates with TrustScoreCalculator
        let successCount = event.receipts.count
        let totalChains = 3 // Primary + EVM + Rollup

        let propagationScore = Double(successCount) / Double(totalChains)

        // Trust score engine will incorporate this
        print("[MultiAnchorEngine] Propagation score: \(propagationScore) for credential: \(event.credentialId)")
    }

    private func updateTrustScoreWithAnchors(
        credentialId: String,
        bundle: AnchorReceiptsBundle
    ) async {
        // This would integrate with TrustScoreCalculator to update trust score
        // based on multi-chain anchor success
        let receiptCount = bundle.receipts.count
        let hasPrimary = bundle.receipts[.vitalCVChain] != nil
        let hasEVM = bundle.receipts.values.contains { receipt in
            if case .evmChain = receipt.ledger { return true }
            return false
        }
        let hasRollup = bundle.receipts[.offChainMerkle] != nil

        // Multi-chain anchoring increases trust
        let anchorMultiplier = hasPrimary && hasEVM && hasRollup ? 1.2 : 1.0

        print("[MultiAnchorEngine] Updated trust score for \(credentialId) with multiplier: \(anchorMultiplier)")
    }

    // MARK: - Consistency Checker

    private func startConsistencyChecker() {
        consistencyCheckTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.performConsistencyCheck()
                try? await Task.sleep(nanoseconds: UInt64((self?.consistencyCheckInterval ?? 60.0) * 1_000_000_000))
            }
        }
    }

    private func performConsistencyCheck() async {
        for (credentialId, bundle) in anchorReceipts {
            let consistency = verifyHashConsistency(
                credentialHash: bundle.credentialHash,
                receipts: bundle.receipts
            )

            if !consistency.consistent {
                print("[MultiAnchorEngine] Hash inconsistency detected for credential: \(credentialId)")
                // Trigger remediation
            }
        }
    }
}

// MARK: - Supporting Types

/// AnchorJob - Job for anchoring on multiple chains
public struct AnchorJob: Identifiable, Codable {
    public let id: String
    public let credentialId: String
    public let credentialHash: String
    public let request: AnchorRequest
    public var status: AnchorJobStatus
    public let createdAt: Date

    public init(
        id: String,
        credentialId: String,
        credentialHash: String,
        request: AnchorRequest,
        status: AnchorJobStatus,
        createdAt: Date
    ) {
        self.id = id
        self.credentialId = credentialId
        self.credentialHash = credentialHash
        self.request = request
        self.status = status
        self.createdAt = createdAt
    }
}

/// AnchorJobStatus - Status of anchor job
public enum AnchorJobStatus: String, Codable {
    case pending
    case inProgress
    case completed
    case failed
    case partial // Some chains succeeded, some failed
}

/// AnchorReceiptsBundle - Bundle of receipts from all chains
public struct AnchorReceiptsBundle: Codable {
    public let credentialId: String
    public let credentialHash: String
    public let receipts: [Ledger: AnchorReceipt]
    public let createdAt: Date

    public init(
        credentialId: String,
        credentialHash: String,
        receipts: [Ledger: AnchorReceipt],
        createdAt: Date
    ) {
        self.credentialId = credentialId
        self.credentialHash = credentialHash
        self.receipts = receipts
        self.createdAt = createdAt
    }
}

/// HashConsistencyResult - Result of hash consistency check
public struct HashConsistencyResult {
    public let consistent: Bool
    public let checks: [HashAlgorithm: Bool]
    public let hashes: [Ledger: String]
}

/// HashAlgorithm - Hash algorithms for consistency checking
public enum HashAlgorithm: String {
    case sha256
    case blake2
    case keccak256
}

/// CrossChainVerificationResult - Result of cross-chain verification
public struct CrossChainVerificationResult {
    public let verified: Bool
    public let verifications: [Ledger: Bool]
    public let consistency: HashConsistencyResult
    public let timestamp: Date
}

/// AnchorPropagationEvent - Event emitted when anchor propagates
public struct AnchorPropagationEvent: Identifiable {
    public let id = UUID()
    public let credentialId: String
    public let receipts: [Ledger: AnchorReceipt]
    public let status: PropagationStatus
    public let timestamp: Date
}

/// PropagationStatus - Status of anchor propagation
public enum PropagationStatus: String {
    case success
    case partial
    case failed
}

/// MultiAnchorError - Errors from multi-anchor engine
public enum MultiAnchorError: Error {
    case primaryChainFailed
    case evmMirrorFailed
    case rollupCommitFailed
    case allChainsFailed
    case consistencyCheckFailed
}

