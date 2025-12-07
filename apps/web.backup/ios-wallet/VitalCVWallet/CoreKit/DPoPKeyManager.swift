//
//  DPoPKeyManager.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 1
//  Global DPoP key manager with automatic rotation intervals
//

import Foundation
import CryptoKit

/// DPoPKeyManager - Manages DPoP keys with automatic rotation
public class DPoPKeyManager {
    public static let shared = DPoPKeyManager()

    // MARK: - Configuration

    /// Default rotation interval: 7 days
    public var rotationInterval: TimeInterval = 7 * 24 * 60 * 60

    /// Minimum rotation interval: 1 day
    public static let minRotationInterval: TimeInterval = 24 * 60 * 60

    /// Maximum rotation interval: 90 days
    public static let maxRotationInterval: TimeInterval = 90 * 24 * 60 * 60

    // MARK: - Private Properties

    private var currentKey: P256.Signing.PrivateKey?
    private var keyCreatedAt: Date?
    private var keyRotationTimer: Timer?
    private let keychainKey = "dpop.private.key"
    private let keychainMetadataKey = "dpop.key.metadata"
    private let queue = DispatchQueue(label: "com.vitalcv.dpop.keymanager", attributes: .concurrent)

    // MARK: - Initialization

    private init() {
        loadOrGenerateKey()
        scheduleRotationIfNeeded()
    }

    // MARK: - Key Management

    /// Get the current DPoP private key, rotating if necessary
    public func getCurrentKey() throws -> P256.Signing.PrivateKey {
        return try queue.sync {
            // Check if rotation is needed
            if shouldRotateKey() {
                rotateKey()
            }

            guard let key = currentKey else {
                throw DPoPKeyManagerError.missingKey
            }

            return key
        }
    }

    /// Force immediate key rotation
    public func rotateKey() {
        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }

            // Generate new key
            let newKey = P256.Signing.PrivateKey()
            let keyData = newKey.rawRepresentation.base64EncodedString()

            // Save to Keychain
            _ = KeychainService.shared.save(keyData, key: self.keychainKey)

            // Update metadata
            let metadata = DPoPKeyMetadata(
                createdAt: Date(),
                rotationInterval: self.rotationInterval
            )
            if let metadataData = try? JSONEncoder().encode(metadata),
               let metadataString = String(data: metadataData, encoding: .utf8) {
                _ = KeychainService.shared.save(metadataString, key: self.keychainMetadataKey)
            }

            // Update in-memory state
            self.currentKey = newKey
            self.keyCreatedAt = Date()

            // Cancel old timer and schedule new one
            self.keyRotationTimer?.invalidate()
            self.scheduleRotationIfNeeded()

            // Log rotation
            print("🔑 DPoP key rotated at \(Date())")
        }
    }

    // MARK: - Private Methods

    private func loadOrGenerateKey() {
        queue.async(flags: .barrier) { [weak self] in
            guard let self = self else { return }

            // Try to load from Keychain
            if let keyData = KeychainService.shared.load(self.keychainKey),
               let key = try? P256.Signing.PrivateKey(rawRepresentation: Data(base64Encoded: keyData) ?? Data()) {
                self.currentKey = key

                // Load metadata
                if let metadataString = KeychainService.shared.load(self.keychainMetadataKey),
                   let metadataData = metadataString.data(using: .utf8),
                   let metadata = try? JSONDecoder().decode(DPoPKeyMetadata.self, from: metadataData) {
                    self.keyCreatedAt = metadata.createdAt
                    self.rotationInterval = metadata.rotationInterval
                } else {
                    // No metadata found, assume key was just created
                    self.keyCreatedAt = Date()
                }
            } else {
                // Generate new key
                let newKey = P256.Signing.PrivateKey()
                self.currentKey = newKey
                self.keyCreatedAt = Date()

                // Save to Keychain
                let keyData = newKey.rawRepresentation.base64EncodedString()
                _ = KeychainService.shared.save(keyData, key: self.keychainKey)

                // Save metadata
                let metadata = DPoPKeyMetadata(
                    createdAt: Date(),
                    rotationInterval: self.rotationInterval
                )
                if let metadataData = try? JSONEncoder().encode(metadata),
                   let metadataString = String(data: metadataData, encoding: .utf8) {
                    _ = KeychainService.shared.save(metadataString, key: self.keychainMetadataKey)
                }
            }
        }
    }

    private func shouldRotateKey() -> Bool {
        guard let createdAt = keyCreatedAt else {
            return true
        }

        let age = Date().timeIntervalSince(createdAt)
        return age >= rotationInterval
    }

    private func scheduleRotationIfNeeded() {
        guard let createdAt = keyCreatedAt else { return }

        let age = Date().timeIntervalSince(createdAt)
        let timeUntilRotation = max(0, rotationInterval - age)

        // Schedule rotation timer
        keyRotationTimer?.invalidate()
        keyRotationTimer = Timer.scheduledTimer(withTimeInterval: timeUntilRotation, repeats: false) { [weak self] _ in
            self?.rotateKey()
        }
    }

    // MARK: - Public Key JWK

    /// Get the public key in JWK format
    public func getPublicKeyJWK() throws -> [String: String] {
        let key = try getCurrentKey()
        let publicKey = key.publicKey
        let publicKeyData = publicKey.rawRepresentation

        // Extract x and y coordinates from uncompressed public key
        // P256 public key is 65 bytes: 0x04 + 32 bytes x + 32 bytes y
        guard publicKeyData.count == 65, publicKeyData[0] == 0x04 else {
            throw DPoPKeyManagerError.invalidKeyFormat
        }

        let xData = publicKeyData[1..<33]
        let yData = publicKeyData[33..<65]

        return [
            "kty": "EC",
            "crv": "P-256",
            "x": xData.base64URLEncodedString(),
            "y": yData.base64URLEncodedString()
        ]
    }

    /// Get key age in seconds
    public func getKeyAge() -> TimeInterval? {
        guard let createdAt = keyCreatedAt else { return nil }
        return Date().timeIntervalSince(createdAt)
    }

    /// Get time until next rotation in seconds
    public func getTimeUntilRotation() -> TimeInterval? {
        guard let age = getKeyAge() else { return nil }
        return max(0, rotationInterval - age)
    }
}

// MARK: - Supporting Types

private struct DPoPKeyMetadata: Codable {
    let createdAt: Date
    let rotationInterval: TimeInterval
}

public enum DPoPKeyManagerError: Error, LocalizedError {
    case missingKey
    case invalidKeyFormat
    case rotationFailed

    var errorDescription: String? {
        switch self {
        case .missingKey:
            return "DPoP key is missing"
        case .invalidKeyFormat:
            return "DPoP key has invalid format"
        case .rotationFailed:
            return "DPoP key rotation failed"
        }
    }
}

// MARK: - Extensions

extension Data {
    func base64URLEncodedString() -> String {
        return base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}








