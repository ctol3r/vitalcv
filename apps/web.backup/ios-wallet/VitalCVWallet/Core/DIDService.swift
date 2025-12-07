//
//  DIDService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 8
//  DID generation and management service
//

import Foundation
import CryptoKit

class DIDService {
    static let shared = DIDService()

    private let keychain = KeychainService.shared
    private let didKey = "user.did"
    private let privateKeyKey = "user.did.privateKey"

    private init() {}

    // MARK: - DID Creation

    func createDID() async throws -> String {
        // Check if DID already exists
        if let existingDID = loadDID() {
            return existingDID
        }

        // Generate Ed25519 key pair
        let privateKey = Curve25519.Signing.PrivateKey()
        let publicKey = privateKey.publicKey

        // Create DID using did:key method
        let publicKeyBase58 = publicKey.rawRepresentation.base58EncodedString()
        let did = "did:key:\(publicKeyBase58.prefix(32))"

        // Store DID and private key
        try saveDID(did)
        try savePrivateKey(privateKey.rawRepresentation)

        return did
    }

    // MARK: - DID Management

    func hasDID() -> Bool {
        return loadDID() != nil
    }

    func loadDID() -> String? {
        return keychain.loadDID()
    }

    private func saveDID(_ did: String) throws {
        guard keychain.saveDID(did) else {
            throw DIDError.saveFailed
        }
    }

    func deleteDID() throws {
        guard keychain.deleteDID() else {
            throw DIDError.deleteFailed
        }
        try deletePrivateKey()
    }

    // MARK: - Private Key Management

    private func savePrivateKey(_ keyData: Data) throws {
        guard keychain.save(data: keyData, key: privateKeyKey) else {
            throw DIDError.keySaveFailed
        }
    }

    private func loadPrivateKey() -> Data? {
        return keychain.load(key: privateKeyKey)
    }

    private func deletePrivateKey() throws {
        guard keychain.delete(key: privateKeyKey) else {
            throw DIDError.keyDeleteFailed
        }
    }

    // MARK: - Signing

    func sign(data: Data) throws -> Data {
        guard let privateKeyData = loadPrivateKey() else {
            throw DIDError.privateKeyNotFound
        }

        let privateKey = try Curve25519.Signing.PrivateKey(rawRepresentation: privateKeyData)
        return try privateKey.signature(for: data)
    }

    // MARK: - Wallet Import/Recovery (Task 7)

    func recoverDID(fromMnemonic mnemonic: String) async throws -> String {
        // In production, use BIP39 mnemonic to derive keys
        // For now, simplified version
        let seed = mnemonic.data(using: .utf8)!
        let hash = SHA256.hash(data: seed)
        let privateKey = Curve25519.Signing.PrivateKey(rawRepresentation: Data(hash.prefix(32)))
        let publicKey = privateKey.publicKey
        let publicKeyBase58 = publicKey.rawRepresentation.base58EncodedString()
        let did = "did:key:\(publicKeyBase58.prefix(32))"

        try saveDID(did)
        try savePrivateKey(privateKey.rawRepresentation)

        return did
    }

    func importDID(fromDocument document: String) async throws -> String {
        // Parse DID document JSON
        guard let data = document.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let did = json["id"] as? String else {
            throw DIDError.invalidDocument
        }

        // Extract and store keys from document
        if let verificationMethods = json["verificationMethod"] as? [[String: Any]],
           let firstMethod = verificationMethods.first,
           let publicKeyMultibase = firstMethod["publicKeyMultibase"] as? String {
            // Store public key (simplified - in production, properly decode multibase)
            let keyData = publicKeyMultibase.data(using: .utf8) ?? Data()
            try saveDID(did)
            // Note: In production, properly handle key import
        }

        return did
    }

    func generateBackupData(for did: String) async throws -> Data {
        guard let privateKeyData = loadPrivateKey() else {
            throw DIDError.privateKeyNotFound
        }

        let backupData = BackupData(
            did: did,
            privateKey: privateKeyData,
            createdAt: Date()
        )

        return try JSONEncoder().encode(backupData)
    }
}

// MARK: - Backup Data

struct BackupData: Codable {
    let did: String
    let privateKey: Data
    let createdAt: Date
}

// MARK: - DID Errors

enum DIDError: LocalizedError {
    case saveFailed
    case deleteFailed
    case keySaveFailed
    case keyDeleteFailed
    case privateKeyNotFound
    case invalidDocument

    var errorDescription: String? {
        switch self {
        case .saveFailed:
            return "Failed to save DID"
        case .deleteFailed:
            return "Failed to delete DID"
        case .keySaveFailed:
            return "Failed to save private key"
        case .keyDeleteFailed:
            return "Failed to delete private key"
        case .privateKeyNotFound:
            return "Private key not found"
        case .invalidDocument:
            return "Invalid DID document"
        }
    }
}

// MARK: - Base58 Encoding Extension

extension Data {
    func base58EncodedString() -> String {
        // Simplified base58 encoding (in production, use a proper library)
        let alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        var result = ""
        var num = self.reduce(0) { $0 * 256 + UInt64($1) }

        if num == 0 {
            return "1"
        }

        while num > 0 {
            result = String(alphabet[alphabet.index(alphabet.startIndex, offsetBy: Int(num % 58))]) + result
            num /= 58
        }

        return result
    }
}

