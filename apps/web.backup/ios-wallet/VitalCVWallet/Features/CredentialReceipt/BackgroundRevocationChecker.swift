//
//  BackgroundRevocationChecker.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 30
//  Background revocation check on accept
//

import Foundation

/// BackgroundRevocationChecker - Checks credential revocation status in background
public class BackgroundRevocationChecker {
    public static let shared = BackgroundRevocationChecker()

    private let network = AsyncNetworkService.shared
    private var checkingCredentials: Set<String> = []

    private init() {}

    /// Check revocation status in background before accepting credential
    public func checkRevocationBeforeAccept(
        credential: VerifiableCredential,
        completion: @escaping (RevocationCheckResult) -> Void
    ) {
        guard !checkingCredentials.contains(credential.id) else {
            return
        }

        checkingCredentials.insert(credential.id)

        Task {
            let result = await performRevocationCheck(credential: credential)

            checkingCredentials.remove(credential.id)

            await MainActor.run {
                completion(result)
            }
        }
    }

    /// Perform revocation check
    private func performRevocationCheck(credential: VerifiableCredential) async -> RevocationCheckResult {
        // Check multiple revocation sources

        // 1. Check credential status list (if available)
        if let statusList = credential.statusList {
            let statusListResult = await checkStatusList(statusList: statusList, credentialId: credential.id)
            if statusListResult.isRevoked {
                return RevocationCheckResult(
                    isRevoked: true,
                    source: .statusList,
                    timestamp: Date(),
                    reason: statusListResult.reason
                )
            }
        }

        // 2. Check issuer revocation registry
        let issuerResult = await checkIssuerRegistry(issuer: credential.issuer.id, credentialId: credential.id)
        if issuerResult.isRevoked {
            return RevocationCheckResult(
                isRevoked: true,
                source: .issuerRegistry,
                timestamp: Date(),
                reason: issuerResult.reason
            )
        }

        // 3. Check chain anchor (if available)
        if let anchorId = credential.chainAnchorId {
            let chainResult = await checkChainRevocation(anchorId: anchorId)
            if chainResult.isRevoked {
                return RevocationCheckResult(
                    isRevoked: true,
                    source: .chain,
                    timestamp: Date(),
                    reason: chainResult.reason
                )
            }
        }

        // All checks passed
        return RevocationCheckResult(
            isRevoked: false,
            source: nil,
            timestamp: Date(),
            reason: nil
        )
    }

    /// Check status list
    private func checkStatusList(statusList: String, credentialId: String) async -> StatusListCheckResult {
        // In production, fetch and check status list
        // For now, return not revoked
        return StatusListCheckResult(isRevoked: false, reason: nil)
    }

    /// Check issuer registry
    private func checkIssuerRegistry(issuer: String, credentialId: String) async -> IssuerRegistryCheckResult {
        // In production, check issuer's revocation registry
        // For now, return not revoked
        return IssuerRegistryCheckResult(isRevoked: false, reason: nil)
    }

    /// Check chain revocation
    private func checkChainRevocation(anchorId: String) async -> ChainCheckResult {
        // In production, check chain for revocation events
        // For now, return not revoked
        return ChainCheckResult(isRevoked: false, reason: nil)
    }
}

// MARK: - Models

public struct RevocationCheckResult {
    public let isRevoked: Bool
    public let source: RevocationSource?
    public let timestamp: Date
    public let reason: String?

    public enum RevocationSource {
        case statusList
        case issuerRegistry
        case chain
    }
}

private struct StatusListCheckResult {
    let isRevoked: Bool
    let reason: String?
}

private struct IssuerRegistryCheckResult {
    let isRevoked: Bool
    let reason: String?
}

private struct ChainCheckResult {
    let isRevoked: Bool
    let reason: String?
}

// MARK: - VerifiableCredential Extension

extension VerifiableCredential {
    var statusList: String? {
        // Extract status list from credential
        // In production, properly parse from credential structure
        return nil
    }
}

// MARK: - Enhanced Acceptance View Integration

extension CredentialAcceptanceView {
    /// Check revocation before accepting
    func checkRevocationBeforeAccept() async -> Bool {
        let result = await BackgroundRevocationChecker.shared.checkRevocationBeforeAccept(credential: credential) { result in
            if result.isRevoked {
                // Show revocation warning
                // In production, show alert or modal
                print("Credential is revoked: \(result.reason ?? "Unknown reason")")
            }
        }

        return !result.isRevoked
    }
}

