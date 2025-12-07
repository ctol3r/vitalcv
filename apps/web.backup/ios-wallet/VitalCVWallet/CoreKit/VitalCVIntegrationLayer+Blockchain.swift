//
//  VitalCVIntegrationLayer+Blockchain.swift
//  VitalCVWallet
//
//  Created: Batch 135-A - Tasks 42-46
//  Blockchain anchoring integration with backend
//

import Foundation

// MARK: - Blockchain Anchoring Integration

extension VitalCVIntegrationLayer {

    // MARK: - Task 42: Call backend /api/chain/anchor/:id to fetch anchor proof

    /// Fetch anchor proof from backend
    public func fetchAnchorProof(anchorId: String) async throws -> AnchorProof {
        let response: AnchorProofResponse = try await networkClient.get(
            "/api/chain/anchor/\(anchorId)"
        )

        return AnchorProof(
            anchorId: anchorId,
            credentialId: response.credentialId,
            credentialHash: response.credentialHash,
            transactionHash: response.transactionHash,
            blockNumber: response.blockNumber,
            blockHash: response.blockHash,
            ledgerId: response.ledgerId,
            timestamp: response.timestamp,
            status: response.status,
            confirmations: response.confirmations
        )
    }

    // MARK: - Task 43: Add anchor timestamp validation

    /// Validate anchor timestamp
    public func validateAnchorTimestamp(_ anchor: AnchorProof) -> AnchorTimestampValidation {
        let now = Date()
        let anchorTime = anchor.timestamp
        let age = now.timeIntervalSince(anchorTime)

        // Define thresholds
        let freshnessThreshold: TimeInterval = 86400 // 24 hours
        let stalenessThreshold: TimeInterval = 2592000 // 30 days

        var status: AnchorTimestampStatus
        var message: String

        if age < freshnessThreshold {
            status = .fresh
            message = "Anchor is fresh"
        } else if age < stalenessThreshold {
            status = .acceptable
            message = "Anchor is acceptable but may need refreshing"
        } else {
            status = .stale
            message = "Anchor is stale and should be refreshed"
        }

        return AnchorTimestampValidation(
            status: status,
            message: message,
            age: age,
            timestamp: anchorTime
        )
    }

    // MARK: - Task 44: Verify block number, tx hash, ledger ID

    /// Verify anchor proof details
    public func verifyAnchorProof(_ anchor: AnchorProof) async throws -> AnchorVerificationResult {
        // Verify block number exists
        guard let blockNumber = anchor.blockNumber, blockNumber > 0 else {
            return AnchorVerificationResult(
                verified: false,
                error: "Invalid block number",
                details: []
            )
        }

        // Verify transaction hash format
        guard let txHash = anchor.transactionHash,
              txHash.count >= 32 else {
            return AnchorVerificationResult(
                verified: false,
                error: "Invalid transaction hash",
                details: []
            )
        }

        // Verify ledger ID
        guard let ledgerId = anchor.ledgerId, !ledgerId.isEmpty else {
            return AnchorVerificationResult(
                verified: false,
                error: "Missing ledger ID",
                details: []
            )
        }

        // Query backend for on-chain verification
        let verificationRequest = AnchorVerificationRequest(
            transactionHash: txHash,
            blockNumber: blockNumber,
            ledgerId: ledgerId
        )

        let backendVerification: BackendAnchorVerification = try await networkClient.post(
            "/api/chain/verify-anchor",
            body: verificationRequest
        )

        return AnchorVerificationResult(
            verified: backendVerification.verified,
            error: backendVerification.error,
            details: backendVerification.details ?? []
        )
    }

    // MARK: - Task 45: Integrate anchor status into trustScore

    /// Calculate trust score including anchor status
    public func calculateTrustScoreWithAnchor(
        baseTrustScore: Double,
        anchor: AnchorProof?
    ) -> Double {
        guard let anchor = anchor else {
            // No anchor = reduced trust
            return baseTrustScore * 0.7
        }

        // Base anchor contribution
        var anchorMultiplier = 1.0

        // Adjust based on anchor status
        switch anchor.status.lowercased() {
        case "confirmed", "finalized":
            anchorMultiplier = 1.0
        case "pending", "processing":
            anchorMultiplier = 0.85
        case "failed", "rejected":
            anchorMultiplier = 0.5
        default:
            anchorMultiplier = 0.8
        }

        // Adjust based on confirmations
        if let confirmations = anchor.confirmations {
            if confirmations >= 12 {
                anchorMultiplier *= 1.0
            } else if confirmations >= 6 {
                anchorMultiplier *= 0.95
            } else if confirmations > 0 {
                anchorMultiplier *= 0.9
            } else {
                anchorMultiplier *= 0.7
            }
        }

        // Adjust based on timestamp freshness
        let timestampValidation = validateAnchorTimestamp(anchor)
        switch timestampValidation.status {
        case .fresh:
            break // No adjustment
        case .acceptable:
            anchorMultiplier *= 0.95
        case .stale:
            anchorMultiplier *= 0.8
        }

        return baseTrustScore * anchorMultiplier
    }

    // MARK: - Task 46: Add automated anchor re-checker for expired anchors

    /// Start automated anchor re-checker
    public func startAnchorRechecker(
        checkInterval: TimeInterval = 3600 // 1 hour default
    ) {
        Task {
            await runAnchorRechecker(interval: checkInterval)
        }
    }

    private func runAnchorRechecker(interval: TimeInterval) async {
        while true {
            // Get all credentials with anchors
            let credentials = await AppStateContainer.shared.credentials

            for credential in credentials {
                guard let anchorId = credential.chainAnchorId else {
                    continue
                }

                do {
                    // Fetch current anchor status
                    let anchor = try await fetchAnchorProof(anchorId: anchorId)

                    // Check if anchor needs refreshing
                    let timestampValidation = validateAnchorTimestamp(anchor)

                    if timestampValidation.status == .stale {
                        // Request anchor refresh from backend
                        try await requestAnchorRefresh(anchorId: anchorId)
                    }

                    // Verify anchor if needed
                    if anchor.status != "confirmed" {
                        let verification = try await verifyAnchorProof(anchor)
                        if !verification.verified {
                            // Log warning
                            await MainActor.run {
                                ErrorHandler.shared.handle(
                                    NSError(domain: "Anchor", code: 1, userInfo: [NSLocalizedDescriptionKey: "Anchor verification failed for \(anchorId)"]),
                                    context: "Anchor Rechecker"
                                )
                            }
                        }
                    }
                } catch {
                    // Log error but continue
                    await MainActor.run {
                        ErrorHandler.shared.handle(error, context: "Anchor Rechecker")
                    }
                }
            }

            // Wait before next check
            try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
        }
    }

    private func requestAnchorRefresh(anchorId: String) async throws {
        let request = AnchorRefreshRequest(anchorId: anchorId)
        let _: AnchorRefreshResponse = try await networkClient.post(
            "/api/chain/anchor/\(anchorId)/refresh",
            body: request
        )
    }
}

// MARK: - Blockchain Models

struct AnchorProof {
    let anchorId: String
    let credentialId: String?
    let credentialHash: String
    let transactionHash: String?
    let blockNumber: Int64?
    let blockHash: String?
    let ledgerId: String?
    let timestamp: Date
    let status: String
    let confirmations: Int?
}

struct AnchorProofResponse: Codable {
    let credentialId: String?
    let credentialHash: String
    let transactionHash: String?
    let blockNumber: Int64?
    let blockHash: String?
    let ledgerId: String?
    let timestamp: Date
    let status: String
    let confirmations: Int?
}

struct AnchorTimestampValidation {
    let status: AnchorTimestampStatus
    let message: String
    let age: TimeInterval
    let timestamp: Date
}

enum AnchorTimestampStatus {
    case fresh
    case acceptable
    case stale
}

struct AnchorVerificationRequest: Codable {
    let transactionHash: String
    let blockNumber: Int64
    let ledgerId: String
}

struct BackendAnchorVerification: Codable {
    let verified: Bool
    let error: String?
    let details: [String]?
}

struct AnchorVerificationResult {
    let verified: Bool
    let error: String?
    let details: [String]
}

struct AnchorRefreshRequest: Codable {
    let anchorId: String
}

struct AnchorRefreshResponse: Codable {
    let success: Bool
    let newAnchorId: String?
    let message: String?
}

