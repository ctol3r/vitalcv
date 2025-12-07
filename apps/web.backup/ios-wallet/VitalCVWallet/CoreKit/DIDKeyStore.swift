//
//  DIDKeyStore.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 2
//  DIDKeyStore with automatic key rotation
//

import Foundation
import CryptoKit

/// DIDKeyStore - Manages DID keys with automatic rotation
public class DIDKeyStore {
    public static let shared = DIDKeyStore()

    private let keychain = KeychainService.shared
    private let rotationInterval: TimeInterval = 90 * 24 * 60 * 60 // 90 days
    private let keyPrefix = "did_key_"

    private init() {}

    // MARK: - Key Management

    /// Get or create current active key for DID
    public func getActiveKey(for did: String) throws -> P256.Signing.PrivateKey {
        let keyId = currentKeyId(for: did)

        if let existingKey = loadKey(did: did, keyId: keyId) {
            return existingKey
        }

        // Create new key
        return try createNewKey(for: did)
    }

    /// Get all keys for a DID (including rotated keys)
    public func getAllKeys(for did: String) -> [DIDKey] {
        let keychainKeys = keychain.getAllKeys(prefix: keyPrefix + did + "_")
        return keychainKeys.compactMap { keyId in
            guard let keyData = keychain.load(key: keyId),
                  let key = try? P256.Signing.PrivateKey(rawRepresentation: keyData) else {
                return nil
            }

            return DIDKey(
                id: keyId,
                did: did,
                privateKey: key,
                createdAt: extractTimestamp(from: keyId),
                rotatedAt: nil,
                isActive: keyId == currentKeyId(for: did)
            )
        }
    }

    /// Rotate key for DID (creates new key, marks old as rotated)
    public func rotateKey(for did: String) throws -> P256.Signing.PrivateKey {
        // Mark current key as rotated
        let currentKeyId = currentKeyId(for: did)
        if let currentKey = loadKey(did: did, keyId: currentKeyId) {
            markKeyRotated(did: did, keyId: currentKeyId)
        }

        // Create new key
        let newKey = try createNewKey(for: did)

        // Update rotation timestamp
        saveRotationTimestamp(for: did)

        return newKey
    }

    /// Check if key rotation is needed
    public func shouldRotateKey(for did: String) -> Bool {
        guard let lastRotation = getLastRotationTimestamp(for: did) else {
            // No rotation yet, check if key is older than rotation interval
            if let oldestKey = getAllKeys(for: did).min(by: { $0.createdAt < $1.createdAt }) {
                let age = Date().timeIntervalSince(oldestKey.createdAt)
                return age >= rotationInterval
            }
            return false
        }

        let timeSinceRotation = Date().timeIntervalSince(lastRotation)
        return timeSinceRotation >= rotationInterval
    }

    /// Auto-rotate if needed
    @discardableResult
    public func autoRotateIfNeeded(for did: String) throws -> P256.Signing.PrivateKey? {
        guard shouldRotateKey(for: did) else {
            return nil
        }

        return try rotateKey(for: did)
    }

    // MARK: - Key Operations

    private func createNewKey(for did: String) throws -> P256.Signing.PrivateKey {
        let key = P256.Signing.PrivateKey()
        let keyId = generateKeyId(for: did)

        guard keychain.save(key: keyId, data: key.rawRepresentation) else {
            throw DIDKeyStoreError.saveFailed
        }

        // Save key metadata
        saveKeyMetadata(did: did, keyId: keyId, createdAt: Date())

        return key
    }

    private func loadKey(did: String, keyId: String) -> P256.Signing.PrivateKey? {
        guard let keyData = keychain.load(key: keyId) else {
            return nil
        }

        return try? P256.Signing.PrivateKey(rawRepresentation: keyData)
    }

    private func currentKeyId(for did: String) -> String {
        // Try to load current key ID from metadata
        if let metadata = loadKeyMetadata(for: did),
           let currentKeyId = metadata.currentKeyId {
            return currentKeyId
        }

        // Fallback: generate based on DID
        return generateKeyId(for: did)
    }

    private func generateKeyId(for did: String) -> String {
        let timestamp = Int(Date().timeIntervalSince1970)
        return "\(keyPrefix)\(did)_\(timestamp)"
    }

    private func extractTimestamp(from keyId: String) -> Date {
        // Extract timestamp from keyId format: did_key_{did}_{timestamp}
        let components = keyId.split(separator: "_")
        if let lastComponent = components.last,
           let timestamp = Int(lastComponent) {
            return Date(timeIntervalSince1970: TimeInterval(timestamp))
        }
        return Date()
    }

    // MARK: - Metadata Management

    private struct KeyMetadata: Codable {
        let did: String
        let currentKeyId: String?
        let lastRotation: Date?
        let keyHistory: [String] // Key IDs
    }

    private func saveKeyMetadata(did: String, keyId: String, createdAt: Date) {
        var metadata = loadKeyMetadata(for: did) ?? KeyMetadata(
            did: did,
            currentKeyId: nil,
            lastRotation: nil,
            keyHistory: []
        )

        metadata = KeyMetadata(
            did: did,
            currentKeyId: keyId,
            lastRotation: metadata.lastRotation,
            keyHistory: metadata.keyHistory + [keyId]
        )

        saveKeyMetadata(metadata)
    }

    private func markKeyRotated(did: String, keyId: String) {
        var metadata = loadKeyMetadata(for: did) ?? KeyMetadata(
            did: did,
            currentKeyId: nil,
            lastRotation: nil,
            keyHistory: []
        )

        metadata = KeyMetadata(
            did: did,
            currentKeyId: metadata.currentKeyId,
            lastRotation: Date(),
            keyHistory: metadata.keyHistory
        )

        saveKeyMetadata(metadata)
    }

    private func saveRotationTimestamp(for did: String) {
        var metadata = loadKeyMetadata(for: did) ?? KeyMetadata(
            did: did,
            currentKeyId: nil,
            lastRotation: nil,
            keyHistory: []
        )

        metadata = KeyMetadata(
            did: did,
            currentKeyId: metadata.currentKeyId,
            lastRotation: Date(),
            keyHistory: metadata.keyHistory
        )

        saveKeyMetadata(metadata)
    }

    private func getLastRotationTimestamp(for did: String) -> Date? {
        return loadKeyMetadata(for: did)?.lastRotation
    }

    private func loadKeyMetadata(for did: String) -> KeyMetadata? {
        let metadataKey = "\(keyPrefix)metadata_\(did)"
        guard let data = keychain.load(key: metadataKey),
              let metadata = try? JSONDecoder().decode(KeyMetadata.self, from: data) else {
            return nil
        }
        return metadata
    }

    private func saveKeyMetadata(_ metadata: KeyMetadata) {
        let metadataKey = "\(keyPrefix)metadata_\(metadata.did)"
        guard let data = try? JSONEncoder().encode(metadata) else {
            return
        }
        _ = keychain.save(key: metadataKey, data: data)
    }
}

// MARK: - Models

public struct DIDKey {
    public let id: String
    public let did: String
    public let privateKey: P256.Signing.PrivateKey
    public let createdAt: Date
    public let rotatedAt: Date?
    public let isActive: Bool

    public var publicKey: P256.Signing.PublicKey {
        return privateKey.publicKey
    }
}

public enum DIDKeyStoreError: Error {
    case saveFailed
    case loadFailed
    case keyNotFound
    case invalidKey
}

// MARK: - KeychainService Extension

extension KeychainService {
    func getAllKeys(prefix: String) -> [String] {
        // This would need to be implemented in KeychainService
        // For now, return empty array
        return []
    }
}

