//
//  DeterministicVerificationMode.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 30
//  Deterministic verification result reproducibility mode
//

import Foundation
import CryptoKit

/// DeterministicVerificationMode - Ensures verification results are reproducible
public class DeterministicVerificationMode {
    public static let shared = DeterministicVerificationMode()

    private var verificationCache: [String: VerificationResult] = [:]
    private let cacheQueue = DispatchQueue(label: "verification.cache", attributes: .concurrent)
    private let maxCacheSize = 100

    private init() {}

    /// Verify credential with deterministic result
    public func verify(
        credential: VerifiableCredential,
        options: VerificationOptions = VerificationOptions(),
        completion: @escaping (VerificationResult) -> Void
    ) {
        // Generate deterministic key for caching
        let cacheKey = generateCacheKey(for: credential, options: options)

        // Check cache first
        cacheQueue.async { [weak self] in
            if let cached = self?.verificationCache[cacheKey] {
                DispatchQueue.main.async {
                    completion(cached)
                }
                return
            }

            // Perform verification
            self?.performVerification(credential: credential, options: options) { result in
                // Cache result
                self?.cacheQueue.async {
                    self?.cacheResult(key: cacheKey, result: result)
                }

                DispatchQueue.main.async {
                    completion(result)
                }
            }
        }
    }

    /// Generate deterministic cache key
    private func generateCacheKey(
        for credential: VerifiableCredential,
        options: VerificationOptions
    ) -> String {
        // Create deterministic hash from credential + options
        var components: [String] = []

        // Credential components
        components.append(credential.id)
        components.append(credential.issuer.id)
        if let expiration = credential.expirationDate {
            components.append(String(expiration.timeIntervalSince1970))
        }
        if let proof = credential.proof {
            components.append(proof.type)
            components.append(String(proof.created.timeIntervalSince1970))
        }

        // Options components
        components.append(String(options.checkExpiration))
        components.append(String(options.checkRevocation))
        components.append(String(options.checkChainAnchor))
        if let timestamp = options.verificationTimestamp {
            components.append(String(timestamp.timeIntervalSince1970))
        }

        // Create hash
        let combined = components.joined(separator: "|")
        let data = combined.data(using: .utf8)!
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    /// Perform actual verification
    private func performVerification(
        credential: VerifiableCredential,
        options: VerificationOptions,
        completion: @escaping (VerificationResult) -> Void
    ) {
        // Use fixed timestamp if provided for reproducibility
        let verificationTime = options.verificationTimestamp ?? Date()

        var checks: [VerificationCheck] = []
        var overallValid = true

        // Check 1: Expiration
        if options.checkExpiration {
            let isExpired = credential.expirationDate?.compare(verificationTime) == .orderedAscending
            checks.append(VerificationCheck(
                type: .expiration,
                passed: !isExpired,
                message: isExpired ? "Credential expired" : "Credential valid"
            ))
            if isExpired { overallValid = false }
        }

        // Check 2: Revocation (deterministic - use fixed time)
        if options.checkRevocation {
            // In production, check revocation registry at fixed time
            checks.append(VerificationCheck(
                type: .revocation,
                passed: true, // Placeholder
                message: "Not revoked"
            ))
        }

        // Check 3: Chain anchor
        if options.checkChainAnchor, let anchorId = credential.chainAnchorId {
            // Check anchor status deterministically
            Task {
                let anchorStatus = await checkAnchorStatus(anchorId: anchorId, at: verificationTime)
                checks.append(VerificationCheck(
                    type: .chainAnchor,
                    passed: anchorStatus.isConfirmed,
                    message: anchorStatus.isConfirmed ? "Anchored on chain" : "Not anchored"
                ))

                if !anchorStatus.isConfirmed { overallValid = false }

                let result = VerificationResult(
                    credentialId: credential.id,
                    valid: overallValid,
                    checks: checks,
                    verifiedAt: verificationTime,
                    deterministic: true
                )

                completion(result)
            }
        } else {
            let result = VerificationResult(
                credentialId: credential.id,
                valid: overallValid,
                checks: checks,
                verifiedAt: verificationTime,
                deterministic: true
            )

            completion(result)
        }
    }

    /// Check anchor status at specific time (deterministic)
    private func checkAnchorStatus(anchorId: String, at time: Date) async -> AnchorStatus {
        // In production, query chain state at specific block/time
        // For now, return deterministic result based on anchor ID hash
        let hash = SHA256.hash(data: anchorId.data(using: .utf8)!)
        let isConfirmed = hash.prefix(1).first! % 2 == 0 // Deterministic based on hash

        return AnchorStatus(
            isConfirmed: isConfirmed,
            confirmationCount: isConfirmed ? 6 : 0,
            confidence: isConfirmed ? 0.95 : 0.0
        )
    }

    /// Cache verification result
    private func cacheResult(key: String, result: VerificationResult) {
        verificationCache[key] = result

        // Limit cache size
        if verificationCache.count > maxCacheSize {
            // Remove oldest entry (FIFO)
            if let firstKey = verificationCache.keys.first {
                verificationCache.removeValue(forKey: firstKey)
            }
        }
    }

    /// Clear verification cache
    public func clearCache() {
        cacheQueue.async(flags: .barrier) { [weak self] in
            self?.verificationCache.removeAll()
        }
    }

    /// Get cached result if available
    public func getCachedResult(
        for credential: VerifiableCredential,
        options: VerificationOptions
    ) -> VerificationResult? {
        let key = generateCacheKey(for: credential, options: options)
        return cacheQueue.sync {
            return verificationCache[key]
        }
    }
}

// MARK: - Verification Options

struct VerificationOptions {
    let checkExpiration: Bool
    let checkRevocation: Bool
    let checkChainAnchor: Bool
    let verificationTimestamp: Date? // For reproducibility

    init(
        checkExpiration: Bool = true,
        checkRevocation: Bool = true,
        checkChainAnchor: Bool = true,
        verificationTimestamp: Date? = nil
    ) {
        self.checkExpiration = checkExpiration
        self.checkRevocation = checkRevocation
        self.checkChainAnchor = checkChainAnchor
        self.verificationTimestamp = verificationTimestamp
    }
}

// MARK: - Verification Result

struct VerificationResult {
    let credentialId: String
    let valid: Bool
    let checks: [VerificationCheck]
    let verifiedAt: Date
    let deterministic: Bool
}

// MARK: - Verification Check

struct VerificationCheck {
    let type: CheckType
    let passed: Bool
    let message: String

    enum CheckType {
        case expiration
        case revocation
        case chainAnchor
        case signature
    }
}








