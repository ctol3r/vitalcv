//
//  ChainOrchestrator.swift
//  VitalCVWallet
//
//  Created: Chain Orchestration Layer - Phase 1
//  Central chain router for multi-ledger orchestration
//

import Foundation
import CryptoKit
import Combine

/// ChainOrchestrator - Central chain router that controls all ledger interactions
@MainActor
public class ChainOrchestrator: ObservableObject {
    public static let shared = ChainOrchestrator()

    // MARK: - Published State

    @Published public var activeLedgers: [Ledger: LedgerProfile] = [:]
    @Published public var orchestratorCache: [String: CachedAnchorResult] = [:]
    @Published public var healthStatus: [Ledger: LedgerHealthStatus] = [:]

    // MARK: - Configuration

    public var cacheTTL: TimeInterval = 3600 // 1 hour
    public var heartbeatInterval: TimeInterval = 30.0 // 30 seconds
    public var maxCacheSize: Int = 1000

    // MARK: - Private State

    private var heartbeatTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()
    private let selectionLogic = LedgerSelectionLogic()
    private let cacheLock = NSLock()

    // MARK: - Initialization

    private init() {
        setupDefaultLedgers()
        startHeartbeatMonitor()
    }

    // MARK: - Task 1: Central Chain Router

    /// Route anchor request to appropriate ledger(s)
    public func routeAnchorRequest(_ request: AnchorRequest) async throws -> AnchorResponse {
        // Check cache first
        if let cached = getCachedResult(for: request.credentialHash) {
            return cached.response
        }

        // Select ledger(s) based on selection logic
        let selectedLedgers = try selectionLogic.selectLedgers(
            for: request,
            availableLedgers: Array(activeLedgers.keys),
            profiles: activeLedgers
        )

        // Execute anchor on selected ledger(s)
        var responses: [Ledger: AnchorReceipt] = [:]

        for ledger in selectedLedgers {
            do {
                let receipt = try await executeAnchor(
                    request: request,
                    on: ledger
                )
                responses[ledger] = receipt
            } catch {
                // Log error but continue with other ledgers
                print("[ChainOrchestrator] Failed to anchor on \(ledger): \(error)")
            }
        }

        // Create response
        let response = AnchorResponse(
            requestId: request.id,
            credentialHash: request.credentialHash,
            receipts: responses,
            timestamp: Date()
        )

        // Cache result
        cacheResult(request.credentialHash, response: response)

        return response
    }

    // MARK: - Task 2: Ledger Enum

    /// Execute anchor on specific ledger
    private func executeAnchor(
        request: AnchorRequest,
        on ledger: Ledger
    ) async throws -> AnchorReceipt {
        guard let profile = activeLedgers[ledger] else {
            throw ChainOrchestratorError.ledgerNotAvailable
        }

        // Check ledger health
        guard let health = healthStatus[ledger],
              health != .down else {
            throw ChainOrchestratorError.ledgerUnhealthy
        }

        // Route to appropriate ledger handler
        switch ledger {
        case .vitalCVChain:
            return try await anchorOnVitalCVChain(request: request, profile: profile)
        case .evmChain(let chainId):
            return try await anchorOnEVMChain(request: request, profile: profile, chainId: chainId)
        case .tezosChain:
            return try await anchorOnTezosChain(request: request, profile: profile)
        case .offChainMerkle:
            return try await anchorOnOffChainMerkle(request: request, profile: profile)
        }
    }

    private func anchorOnVitalCVChain(
        request: AnchorRequest,
        profile: LedgerProfile
    ) async throws -> AnchorReceipt {
        // In production, call Substrate RPC
        let txHash = generateTransactionHash()
        let blockNumber = Int.random(in: 1_000_000...10_000_000)

        return AnchorReceipt(
            ledger: .vitalCVChain,
            transactionHash: txHash,
            blockNumber: blockNumber,
            timestamp: Date(),
            confirmations: 0,
            status: .pending,
            explorerURL: URL(string: "https://explorer.vitalcv.io/tx/\(txHash.prefix(16))")
        )
    }

    private func anchorOnEVMChain(
        request: AnchorRequest,
        profile: LedgerProfile,
        chainId: String
    ) async throws -> AnchorReceipt {
        // In production, call EVM RPC
        let txHash = generateTransactionHash()
        let blockNumber = Int.random(in: 15_000_000...20_000_000)

        return AnchorReceipt(
            ledger: .evmChain(chainId: chainId),
            transactionHash: txHash,
            blockNumber: blockNumber,
            timestamp: Date(),
            confirmations: 0,
            status: .pending,
            explorerURL: URL(string: "https://etherscan.io/tx/\(txHash.prefix(16))")
        )
    }

    private func anchorOnTezosChain(
        request: AnchorRequest,
        profile: LedgerProfile
    ) async throws -> AnchorReceipt {
        // In production, call Tezos RPC
        let txHash = generateTransactionHash()
        let blockNumber = Int.random(in: 3_000_000...4_000_000)

        return AnchorReceipt(
            ledger: .tezosChain,
            transactionHash: txHash,
            blockNumber: blockNumber,
            timestamp: Date(),
            confirmations: 0,
            status: .pending,
            explorerURL: URL(string: "https://tzkt.io/\(txHash.prefix(16))")
        )
    }

    private func anchorOnOffChainMerkle(
        request: AnchorRequest,
        profile: LedgerProfile
    ) async throws -> AnchorReceipt {
        // Off-chain Merkle store (rollup layer)
        let merkleRoot = generateMerkleRoot(for: request.credentialHash)

        return AnchorReceipt(
            ledger: .offChainMerkle,
            transactionHash: merkleRoot,
            blockNumber: 0, // No block number for off-chain
            timestamp: Date(),
            confirmations: 0,
            status: .confirmed, // Off-chain is immediately confirmed
            explorerURL: nil
        )
    }

    // MARK: - Task 3: LedgerProfile

    private func setupDefaultLedgers() {
        // VitalCVChain (primary Substrate)
        activeLedgers[.vitalCVChain] = LedgerProfile(
            ledger: .vitalCVChain,
            rpcEndpoints: [
                RpcEndpoint(url: "wss://rpc.vitalcv.io", name: "Primary", priority: 1),
                RpcEndpoint(url: "wss://rpc-backup.vitalcv.io", name: "Backup", priority: 2)
            ],
            healthScore: 1.0,
            latency: 0.0,
            finalityType: .finalized,
            isActive: true
        )

        // EVMChain (Ethereum or zkEVM anchor mirror)
        activeLedgers[.evmChain(chainId: "1")] = LedgerProfile(
            ledger: .evmChain(chainId: "1"),
            rpcEndpoints: [
                RpcEndpoint(url: "https://eth-mainnet.alchemyapi.io/v2/demo", name: "EVM Primary", priority: 1),
                RpcEndpoint(url: "https://polygon-rpc.com", name: "Polygon RPC", priority: 2)
            ],
            healthScore: 0.95,
            latency: 0.0,
            finalityType: .probabilistic,
            isActive: true
        )

        // TezosChain (optional SI anchor)
        activeLedgers[.tezosChain] = LedgerProfile(
            ledger: .tezosChain,
            rpcEndpoints: [
                RpcEndpoint(url: "https://rpc.tezos.io", name: "Tezos Primary", priority: 1)
            ],
            healthScore: 0.90,
            latency: 0.0,
            finalityType: .probabilistic,
            isActive: false // Optional, can be enabled
        )

        // Off-chain Merkle store (rollup layer)
        activeLedgers[.offChainMerkle] = LedgerProfile(
            ledger: .offChainMerkle,
            rpcEndpoints: [], // No RPC for off-chain
            healthScore: 1.0,
            latency: 0.0,
            finalityType: .immediate,
            isActive: true
        )

        // Initialize health status
        for ledger in activeLedgers.keys {
            healthStatus[ledger] = .healthy
        }
    }

    // MARK: - Task 4: LedgerSelectionLogic

    /// Get primary ledger for request
    public func getPrimaryLedger(for request: AnchorRequest) -> Ledger? {
        return selectionLogic.getPrimaryLedger(
            for: request,
            availableLedgers: Array(activeLedgers.keys),
            profiles: activeLedgers
        )
    }

    // MARK: - Task 5: AnchorRequest Abstraction

    /// Create anchor request
    public func createAnchorRequest(
        credentialId: String,
        credentialHash: String,
        metadata: [String: Any]? = nil
    ) -> AnchorRequest {
        return AnchorRequest(
            id: UUID().uuidString,
            credentialId: credentialId,
            credentialHash: credentialHash,
            metadata: metadata ?? [:],
            timestamp: Date()
        )
    }

    // MARK: - Task 6: Chain Health Heartbeat Monitor

    private func startHeartbeatMonitor() {
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.performHeartbeat()
                try? await Task.sleep(nanoseconds: UInt64((self?.heartbeatInterval ?? 30.0) * 1_000_000_000))
            }
        }
    }

    private func performHeartbeat() async {
        for (ledger, profile) in activeLedgers {
            let health = await checkLedgerHealth(ledger: ledger, profile: profile)
            healthStatus[ledger] = health.status

            // Update profile with latest metrics
            if var updatedProfile = activeLedgers[ledger] {
                updatedProfile.healthScore = health.healthScore
                updatedProfile.latency = health.latency
                activeLedgers[ledger] = updatedProfile
            }
        }
    }

    private func checkLedgerHealth(
        ledger: Ledger,
        profile: LedgerProfile
    ) async -> LedgerHealthCheck {
        let startTime = Date()

        // Check first available RPC endpoint
        guard let rpcEndpoint = profile.rpcEndpoints.first else {
            return LedgerHealthCheck(
                status: .down,
                healthScore: 0.0,
                latency: 0.0
            )
        }

        do {
            // In production, make actual RPC call
            // For now, simulate health check
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms

            let latency = Date().timeIntervalSince(startTime) * 1000 // Convert to ms

            return LedgerHealthCheck(
                status: .healthy,
                healthScore: 1.0,
                latency: latency
            )
        } catch {
            return LedgerHealthCheck(
                status: .degraded,
                healthScore: 0.5,
                latency: 0.0
            )
        }
    }

    // MARK: - Task 7: Orchestrator Cache

    private func getCachedResult(for credentialHash: String) -> CachedAnchorResult? {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        guard let cached = orchestratorCache[credentialHash] else {
            return nil
        }

        // Check if cache is still valid
        let age = Date().timeIntervalSince(cached.cachedAt)
        if age > cacheTTL {
            orchestratorCache.removeValue(forKey: credentialHash)
            return nil
        }

        return cached
    }

    private func cacheResult(_ credentialHash: String, response: AnchorResponse) {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        // Enforce max cache size
        if orchestratorCache.count >= maxCacheSize {
            // Remove oldest entry
            if let oldest = orchestratorCache.values.min(by: { $0.cachedAt < $1.cachedAt }) {
                orchestratorCache.removeValue(forKey: oldest.response.credentialHash)
            }
        }

        orchestratorCache[credentialHash] = CachedAnchorResult(
            response: response,
            cachedAt: Date()
        )
    }

    // MARK: - Task 8: Deep Link Support

    /// Handle deep link: vitalcv://chain/orchestrator
    public func handleDeepLink(_ url: URL) -> Bool {
        guard url.scheme == "vitalcv",
              url.host == "chain",
              url.pathComponents.contains("orchestrator") else {
            return false
        }

        // Handle orchestrator deep link
        Task {
            await handleOrchestratorDeepLink(url: url)
        }

        return true
    }

    private func handleOrchestratorDeepLink(url: URL) async {
        // Parse query parameters
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []

        // Handle different actions
        for item in queryItems {
            switch item.name {
            case "anchor":
                if let credentialHash = item.value {
                    let request = createAnchorRequest(
                        credentialId: UUID().uuidString,
                        credentialHash: credentialHash
                    )
                    _ = try? await routeAnchorRequest(request)
                }
            case "verify":
                if let credentialHash = item.value {
                    // Trigger verification
                    print("[ChainOrchestrator] Verify request for: \(credentialHash)")
                }
            case "status":
                // Show orchestrator status
                print("[ChainOrchestrator] Status requested")
            default:
                break
            }
        }
    }

    // MARK: - Helper Methods

    private func generateTransactionHash() -> String {
        let data = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        return "0x\(data.map { String(format: "%02x", $0) }.joined())"
    }

    private func generateMerkleRoot(for hash: String) -> String {
        let data = (hash + String(Date().timeIntervalSince1970)).data(using: .utf8)!
        let digest = SHA256.hash(data: data)
        return "0x\(digest.map { String(format: "%02x", $0) }.joined())"
    }
}

// MARK: - Supporting Types

/// Ledger enum - Represents different blockchain types
public enum Ledger: Hashable, Codable {
    case vitalCVChain // Primary Substrate
    case evmChain(chainId: String) // Ethereum or zkEVM anchor mirror
    case tezosChain // Optional SI anchor
    case offChainMerkle // Off-chain Merkle store (rollup layer)
}

/// LedgerProfile - Configuration and status for a ledger
public struct LedgerProfile: Codable {
    public let ledger: Ledger
    public var rpcEndpoints: [RpcEndpoint]
    public var healthScore: Double // 0.0 to 1.0
    public var latency: TimeInterval // in milliseconds
    public let finalityType: FinalityType
    public var isActive: Bool

    public init(
        ledger: Ledger,
        rpcEndpoints: [RpcEndpoint],
        healthScore: Double,
        latency: TimeInterval,
        finalityType: FinalityType,
        isActive: Bool
    ) {
        self.ledger = ledger
        self.rpcEndpoints = rpcEndpoints
        self.healthScore = healthScore
        self.latency = latency
        self.finalityType = finalityType
        self.isActive = isActive
    }
}

/// FinalityType - How finality is achieved on the ledger
public enum FinalityType: String, Codable {
    case immediate // Off-chain, immediate
    case probabilistic // EVM-style, probabilistic finality
    case finalized // Substrate-style, finalized blocks
}

/// LedgerHealthStatus - Current health status of a ledger
public enum LedgerHealthStatus: String, Codable {
    case healthy
    case degraded
    case slow
    case down
    case unknown
}

/// LedgerHealthCheck - Result of health check
public struct LedgerHealthCheck {
    public let status: LedgerHealthStatus
    public let healthScore: Double
    public let latency: TimeInterval
}

/// LedgerSelectionLogic - Logic for selecting which ledger(s) to use
public class LedgerSelectionLogic {
    /// Select ledgers for anchor request
    public func selectLedgers(
        for request: AnchorRequest,
        availableLedgers: [Ledger],
        profiles: [Ledger: LedgerProfile]
    ) throws -> [Ledger] {
        // Primary → Fallback → Tertiary selection
        var selected: [Ledger] = []

        // 1. Primary: VitalCVChain (if available and healthy)
        if availableLedgers.contains(.vitalCVChain),
           let profile = profiles[.vitalCVChain],
           profile.isActive,
           profile.healthScore > 0.7 {
            selected.append(.vitalCVChain)
        }

        // 2. Fallback: EVM Chain (if primary unavailable)
        if selected.isEmpty {
            if let evmLedger = availableLedgers.first(where: {
                if case .evmChain = $0 { return true }
                return false
            }),
            let profile = profiles[evmLedger],
            profile.isActive,
            profile.healthScore > 0.7 {
                selected.append(evmLedger)
            }
        }

        // 3. Tertiary: Off-chain Merkle (always available as last resort)
        if selected.isEmpty {
            selected.append(.offChainMerkle)
        }

        guard !selected.isEmpty else {
            throw ChainOrchestratorError.noLedgersAvailable
        }

        return selected
    }

    /// Get primary ledger for request
    public func getPrimaryLedger(
        for request: AnchorRequest,
        availableLedgers: [Ledger],
        profiles: [Ledger: LedgerProfile]
    ) -> Ledger? {
        do {
            let selected = try selectLedgers(
                for: request,
                availableLedgers: availableLedgers,
                profiles: profiles
            )
            return selected.first
        } catch {
            return nil
        }
    }
}

/// AnchorRequest - Chain-agnostic anchor request
public struct AnchorRequest: Codable {
    public let id: String
    public let credentialId: String
    public let credentialHash: String
    public let metadata: [String: Any]
    public let timestamp: Date

    public init(
        id: String,
        credentialId: String,
        credentialHash: String,
        metadata: [String: Any],
        timestamp: Date
    ) {
        self.id = id
        self.credentialId = credentialId
        self.credentialHash = credentialHash
        self.metadata = metadata
        self.timestamp = timestamp
    }

    // Custom Codable implementation for metadata
    enum CodingKeys: String, CodingKey {
        case id, credentialId, credentialHash, timestamp
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        credentialId = try container.decode(String.self, forKey: .credentialId)
        credentialHash = try container.decode(String.self, forKey: .credentialHash)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        metadata = [:] // Metadata not encoded for simplicity
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(credentialId, forKey: .credentialId)
        try container.encode(credentialHash, forKey: .credentialHash)
        try container.encode(timestamp, forKey: .timestamp)
    }
}

/// AnchorResponse - Response from anchor request
public struct AnchorResponse: Codable {
    public let requestId: String
    public let credentialHash: String
    public let receipts: [Ledger: AnchorReceipt]
    public let timestamp: Date

    public init(
        requestId: String,
        credentialHash: String,
        receipts: [Ledger: AnchorReceipt],
        timestamp: Date
    ) {
        self.requestId = requestId
        self.credentialHash = credentialHash
        self.receipts = receipts
        self.timestamp = timestamp
    }
}

/// AnchorReceipt - Receipt from a specific ledger
public struct AnchorReceipt: Codable {
    public let ledger: Ledger
    public let transactionHash: String
    public let blockNumber: Int
    public let timestamp: Date
    public let confirmations: Int
    public let status: AnchorStatus
    public let explorerURL: URL?

    public init(
        ledger: Ledger,
        transactionHash: String,
        blockNumber: Int,
        timestamp: Date,
        confirmations: Int,
        status: AnchorStatus,
        explorerURL: URL?
    ) {
        self.ledger = ledger
        self.transactionHash = transactionHash
        self.blockNumber = blockNumber
        self.timestamp = timestamp
        self.confirmations = confirmations
        self.status = status
        self.explorerURL = explorerURL
    }
}

/// AnchorStatus - Status of anchor transaction
public enum AnchorStatus: String, Codable {
    case pending
    case confirmed
    case failed
    case rejected
}

/// CachedAnchorResult - Cached anchor result
public struct CachedAnchorResult {
    public let response: AnchorResponse
    public let cachedAt: Date
}

/// ChainOrchestratorError - Errors from chain orchestrator
public enum ChainOrchestratorError: Error {
    case ledgerNotAvailable
    case ledgerUnhealthy
    case noLedgersAvailable
    case anchorFailed
    case cacheError
}

