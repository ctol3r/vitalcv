//
//  AppServicesContainer.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 1
//  Unified container for networking, chain, and proof engines
//

import Foundation
import Combine

/// AppServicesContainer - Unified service container for networking, chain, and proof engines
@MainActor
public class AppServicesContainer: ObservableObject {
    public static let shared = AppServicesContainer()

    // MARK: - Core Services

    /// Network service for API communication
    public let network: AsyncNetworkService

    /// Chain service for blockchain anchoring
    public let chain: ChainAnchorService

    /// Proof engine for credential validation
    public let proof: CredProofEngine

    /// DID resolver with async caching
    public let didResolver: DIDResolver

    /// Transaction logger for proof events
    public let transactionLogger: TransactionLogger

    // MARK: - State

    @Published public var isInitialized: Bool = false
    @Published public var lastSyncDate: Date?

    private var cancellables = Set<AnyCancellable>()

    private init() {
        self.network = AsyncNetworkService.shared
        self.chain = ChainAnchorService.shared
        self.proof = CredProofEngine.shared
        self.didResolver = DIDResolver.shared
        self.transactionLogger = TransactionLogger.shared

        setupObservers()
    }

    // MARK: - Initialization

    /// Initialize all services
    public func initialize() async {
        guard !isInitialized else { return }

        await network.initialize()
        await chain.initialize()
        await didResolver.initialize()
        await transactionLogger.initialize()

        isInitialized = true
        lastSyncDate = Date()
    }

    // MARK: - Unified Operations

    /// Verify credential with full chain validation
    public func verifyCredentialWithChain(_ credential: VerifiableCredential) async throws -> VerificationResult {
        // Log verification start
        await transactionLogger.log(event: .verificationStarted(credentialId: credential.id))

        // Validate proof
        let proofResult = try await proof.validateCredential(credential)

        // Check chain anchor if available
        var chainStatus: ChainAnchorStatus?
        if let anchorId = credential.chainAnchorId {
            chainStatus = try await chain.checkAnchorStatus(anchorId: anchorId)
        }

        // Resolve issuer DID
        let issuerDid = credential.issuer
        let issuerResolved = await didResolver.resolve(did: issuerDid)

        // Log verification complete
        await transactionLogger.log(event: .verificationCompleted(
            credentialId: credential.id,
            valid: proofResult.valid,
            chainStatus: chainStatus
        ))

        return VerificationResult(
            valid: proofResult.valid,
            proofFormat: proofResult.format,
            chainStatus: chainStatus,
            issuerResolved: issuerResolved != nil,
            checks: proofResult.checks
        )
    }

    /// Anchor credential to chain
    public func anchorCredential(_ credential: VerifiableCredential) async throws -> ChainAnchor {
        await transactionLogger.log(event: .anchorStarted(credentialId: credential.id))

        let anchor = try await chain.anchorCredential(credential)

        await transactionLogger.log(event: .anchorCompleted(
            credentialId: credential.id,
            anchorId: anchor.id,
            txHash: anchor.txHash
        ))

        return anchor
    }

    // MARK: - Observers

    private func setupObservers() {
        // Monitor network status
        NotificationCenter.default.publisher(for: .networkStatusChanged)
            .sink { [weak self] _ in
                Task { @MainActor in
                    self?.lastSyncDate = Date()
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Verification Result

public struct VerificationResult {
    public let valid: Bool
    public let proofFormat: ProofFormat
    public let chainStatus: ChainAnchorStatus?
    public let issuerResolved: Bool
    public let checks: [ProofCheck]
}

