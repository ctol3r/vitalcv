//
//  CryptographicallySealedStorage.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 40
//  Cryptographically sealed local storage
//

import Foundation
import CryptoKit

class CryptographicallySealedStorage {
    static let shared = CryptographicallySealedStorage()

    private let keychain = KeychainService.shared
    private var encryptionKey: SymmetricKey?

    private init() {
        loadOrCreateEncryptionKey()
    }

    private func loadOrCreateEncryptionKey() {
        // Generate new encryption key for this session
        // In production, persist encryption key securely in Keychain
        // For now, generate a new key each time (data will need to be re-encrypted)
        encryptionKey = SymmetricKey(size: .bits256)
    }

    func seal(_ data: Data) throws -> Data {
        guard let key = encryptionKey else {
            throw SealedStorageError.noEncryptionKey
        }

        // Use AES-GCM for authenticated encryption
        let sealedBox = try AES.GCM.seal(data, using: key)

        // Combine nonce + ciphertext + tag
        var sealedData = Data()
        sealedData.append(sealedBox.nonce.withUnsafeBytes { Data($0) })
        sealedData.append(sealedBox.ciphertext)
        sealedData.append(sealedBox.tag)

        return sealedData
    }

    func unseal(_ sealedData: Data) throws -> Data {
        guard let key = encryptionKey else {
            throw SealedStorageError.noEncryptionKey
        }

        // Extract nonce, ciphertext, and tag
        guard sealedData.count >= 32 else {
            throw SealedStorageError.invalidData
        }

        let nonceData = sealedData.prefix(12)
        let tagData = sealedData.suffix(16)
        let ciphertext = sealedData.dropFirst(12).dropLast(16)

        let nonce = try AES.GCM.Nonce(data: nonceData)
        let sealedBox = try AES.GCM.SealedBox(
            nonce: nonce,
            ciphertext: ciphertext,
            tag: tagData
        )

        return try AES.GCM.open(sealedBox, using: key)
    }

    func saveSealed(_ data: Data, key: String) -> Bool {
        do {
            let sealed = try seal(data)
            // Use credentials key pattern - in production, extend KeychainService
            if key == "credentials" {
                return keychain.saveCredentials(sealed)
            }
            // For other keys, would need to extend KeychainService
            return false
        } catch {
            print("Failed to seal data: \(error)")
            return false
        }
    }

    func loadSealed(key: String) -> Data? {
        var sealed: Data?
        if key == "credentials" {
            sealed = keychain.loadCredentials()
        }
        // For other keys, would need to extend KeychainService

        guard let sealedData = sealed else {
            return nil
        }

        do {
            return try unseal(sealedData)
        } catch {
            print("Failed to unseal data: \(error)")
            return nil
        }
    }
}

enum SealedStorageError: Error {
    case noEncryptionKey
    case invalidData
    case decryptionFailed
}

// Note: Using KeychainService's existing methods through saveCredentials pattern
// In production, extend KeychainService to expose generic save/load methods

