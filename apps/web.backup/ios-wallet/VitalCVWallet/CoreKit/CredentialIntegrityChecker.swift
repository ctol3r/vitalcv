//
//  CredentialIntegrityChecker.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 5
//  Credential integrity hash check pre-display
//

import Foundation
import CryptoKit

/// CredentialIntegrityChecker - Validates credential integrity before display
public class CredentialIntegrityChecker {
    public static let shared = CredentialIntegrityChecker()

    // MARK: - Initialization

    private init() {}

    // MARK: - Integrity Check

    /// Check credential integrity before display
    public func checkIntegrity(_ credential: VerifiableCredential) -> CredentialIntegrityResult {
        // Calculate hash of credential
        let credentialHash = calculateCredentialHash(credential)

        // Check if hash matches stored hash (if available)
        if let storedHash = getStoredHash(for: credential.id) {
            if credentialHash != storedHash {
                return CredentialIntegrityResult(
                    isValid: false,
                    hash: credentialHash,
                    storedHash: storedHash,
                    issues: ["Credential hash mismatch - credential may have been tampered with"]
                )
            }
        } else {
            // First time seeing this credential, store hash
            storeHash(credentialHash, for: credential.id)
        }

        // Check for missing required fields
        var issues: [String] = []

        if credential.id.isEmpty {
            issues.append("Credential ID is missing")
        }

        if credential.type.isEmpty {
            issues.append("Credential type is missing")
        }

        if credential.credentialSubject == nil {
            issues.append("Credential subject is missing")
        }

        // Check proof integrity if available
        if let proof = credential.proof {
            if proof.type.isEmpty {
                issues.append("Proof type is missing")
            }

            if proof.proofValue.isEmpty {
                issues.append("Proof value is missing")
            }
        }

        return CredentialIntegrityResult(
            isValid: issues.isEmpty,
            hash: credentialHash,
            storedHash: storedHash,
            issues: issues
        )
    }

    /// Validate credential hash against expected hash
    public func validateHash(credential: VerifiableCredential, expectedHash: String) -> Bool {
        let actualHash = calculateCredentialHash(credential)
        return actualHash == expectedHash
    }

    /// Get stored hash for credential
    public func getStoredHash(for credentialId: String) -> String? {
        return KeychainService.shared.load("credential.hash.\(credentialId)")
    }

    /// Store hash for credential
    public func storeHash(_ hash: String, for credentialId: String) {
        _ = KeychainService.shared.save(hash, key: "credential.hash.\(credentialId)")
    }

    /// Calculate hash of credential
    private func calculateCredentialHash(_ credential: VerifiableCredential) -> String {
        // Create canonical JSON representation
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]

        guard let data = try? encoder.encode(credential) else {
            // Fallback: use credential ID + type
            let fallback = "\(credential.id).\(credential.type)".data(using: .utf8) ?? Data()
            return SHA256.hash(data: fallback).compactMap { String(format: "%02x", $0) }.joined()
        }

        // Calculate SHA-256 hash
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    /// Check integrity and throw if invalid
    public func requireIntegrity(_ credential: VerifiableCredential) throws {
        let result = checkIntegrity(credential)

        if !result.isValid {
            throw CredentialIntegrityError.invalidCredential(
                hash: result.hash,
                issues: result.issues
            )
        }
    }
}

// MARK: - Supporting Types

public struct CredentialIntegrityResult {
    public let isValid: Bool
    public let hash: String
    public let storedHash: String?
    public let issues: [String]

    public init(isValid: Bool, hash: String, storedHash: String?, issues: [String]) {
        self.isValid = isValid
        self.hash = hash
        self.storedHash = storedHash
        self.issues = issues
    }
}

public enum CredentialIntegrityError: Error, LocalizedError {
    case invalidCredential(hash: String, issues: [String])
    case hashMismatch(expected: String, actual: String)
    case missingRequiredFields([String])

    public var errorDescription: String? {
        switch self {
        case .invalidCredential(let hash, let issues):
            return "Credential integrity check failed (hash: \(hash.prefix(8))...): \(issues.joined(separator: ", "))"
        case .hashMismatch(let expected, let actual):
            return "Credential hash mismatch: expected \(expected.prefix(8))..., got \(actual.prefix(8))..."
        case .missingRequiredFields(let fields):
            return "Missing required fields: \(fields.joined(separator: ", "))"
        }
    }
}








