//
//  EncryptedProofCache.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 35
//  Encrypted on-device proof cache
//

import Foundation
import CryptoKit

class EncryptedProofCache {
    static let shared = EncryptedProofCache()

    private let cacheKey = "encrypted.proof.cache"
    private var cache: [String: CachedProof] = [:]
    private let cacheLock = NSLock()

    private init() {}

    // MARK: - Cache Operations

    func cacheProof(credentialId: String, proof: Data, expiresAt: Date?) throws {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        // Encrypt proof data
        let encrypted = try encrypt(data: proof)

        let cachedProof = CachedProof(
            credentialId: credentialId,
            encryptedProof: encrypted,
            createdAt: Date(),
            expiresAt: expiresAt
        )

        cache[credentialId] = cachedProof
        persistCache()
    }

    func getProof(for credentialId: String) throws -> Data? {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        guard let cached = cache[credentialId] else {
            return nil
        }

        // Check expiration
        if let expiresAt = cached.expiresAt, expiresAt < Date() {
            cache.removeValue(forKey: credentialId)
            persistCache()
            return nil
        }

        // Decrypt proof
        return try decrypt(encrypted: cached.encryptedProof)
    }

    func hasProof(for credentialId: String) -> Bool {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        guard let cached = cache[credentialId] else {
            return false
        }

        // Check expiration
        if let expiresAt = cached.expiresAt, expiresAt < Date() {
            cache.removeValue(forKey: credentialId)
            persistCache()
            return false
        }

        return true
    }

    func clearCache() {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        cache.removeAll()
        UserDefaults.standard.removeObject(forKey: cacheKey)
    }

    // MARK: - Encryption

    private func encrypt(data: Data) throws -> Data {
        // Generate or retrieve encryption key
        let key = getEncryptionKey()

        // Encrypt using AES-GCM
        let sealedBox = try AES.GCM.seal(data, using: key)

        // Combine nonce and ciphertext
        var encrypted = Data()
        encrypted.append(sealedBox.nonce.withUnsafeBytes { Data($0) })
        encrypted.append(sealedBox.ciphertext)
        encrypted.append(sealedBox.tag)

        return encrypted
    }

    private func decrypt(encrypted: Data) throws -> Data {
        let key = getEncryptionKey()

        // Extract components
        let nonceSize = 12 // AES-GCM nonce size
        let tagSize = 16   // AES-GCM tag size

        guard encrypted.count > nonceSize + tagSize else {
            throw EncryptionError.invalidData
        }

        let nonce = encrypted.prefix(nonceSize)
        let tag = encrypted.suffix(tagSize)
        let ciphertext = encrypted.dropFirst(nonceSize).dropLast(tagSize)

        let sealedBox = try AES.GCM.SealedBox(
            nonce: AES.GCM.Nonce(data: nonce),
            ciphertext: ciphertext,
            tag: tag
        )

        return try AES.GCM.open(sealedBox, using: key)
    }

    private func getEncryptionKey() -> SymmetricKey {
        // Retrieve or generate encryption key from Keychain
        if let keyData = KeychainService.shared.load(key: "proof.cache.key"),
           let key = try? SymmetricKey(data: keyData) {
            return key
        }

        // Generate new key
        let key = SymmetricKey(size: .bits256)
        if let keyData = key.withUnsafeBytes({ Data($0) }) as Data? {
            _ = KeychainService.shared.save(data: keyData, key: "proof.cache.key")
        }

        return key
    }

    // MARK: - Persistence

    private func persistCache() {
        guard let data = try? JSONEncoder().encode(cache) else {
            return
        }

        UserDefaults.standard.set(data, forKey: cacheKey)
    }

    private func loadCache() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let decoded = try? JSONDecoder().decode([String: CachedProof].self, from: data) else {
            return
        }

        cache = decoded
    }
}

// MARK: - Cached Proof

struct CachedProof: Codable {
    let credentialId: String
    let encryptedProof: Data
    let createdAt: Date
    let expiresAt: Date?
}

// MARK: - Encryption Error

enum EncryptionError: LocalizedError {
    case invalidData
    case encryptionFailed
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .invalidData:
            return "Invalid encrypted data"
        case .encryptionFailed:
            return "Encryption failed"
        case .decryptionFailed:
            return "Decryption failed"
        }
    }
}

