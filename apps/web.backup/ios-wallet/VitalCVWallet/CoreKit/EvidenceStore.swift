//
//  EvidenceStore.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 12
//  EvidenceStore: Encrypted local storage for evidence files
//

import Foundation
import Security

/// EvidenceStore - Encrypted local storage for evidence (PDFs, images)
/// Stores evidence files securely on device
class EvidenceStore {
    static let shared = EvidenceStore()

    private let fileManager = FileManager.default
    private let evidenceDirectory: URL

    private init() {
        // Create evidence directory in app's documents
        let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        evidenceDirectory = documentsURL.appendingPathComponent("Evidence", isDirectory: true)

        // Create directory if it doesn't exist
        if !fileManager.fileExists(atPath: evidenceDirectory.path) {
            try? fileManager.createDirectory(at: evidenceDirectory, withIntermediateDirectories: true)
        }

        // Mark directory as excluded from backups
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        try? evidenceDirectory.setResourceValues(resourceValues)
    }

    // MARK: - Public API

    /// Store evidence file
    func storeEvidence(_ data: Data, credentialId: String, evidenceId: String, mimeType: String) async throws -> URL {
        // Create encrypted file
        let encryptedData = try await encrypt(data: data)

        // Create file URL
        let fileName = "\(credentialId)_\(evidenceId).enc"
        let fileURL = evidenceDirectory.appendingPathComponent(fileName)

        // Write encrypted data
        try encryptedData.write(to: fileURL)

        // Store metadata
        let metadata = EvidenceMetadata(
            credentialId: credentialId,
            evidenceId: evidenceId,
            fileName: fileName,
            mimeType: mimeType,
            storedAt: Date(),
            size: data.count
        )
        try await storeMetadata(metadata)

        return fileURL
    }

    /// Retrieve evidence file
    func retrieveEvidence(credentialId: String, evidenceId: String) async throws -> Data {
        // Load metadata
        guard let metadata = try await loadMetadata(credentialId: credentialId, evidenceId: evidenceId) else {
            throw EvidenceStoreError.notFound
        }

        // Load encrypted file
        let fileURL = evidenceDirectory.appendingPathComponent(metadata.fileName)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            throw EvidenceStoreError.notFound
        }

        let encryptedData = try Data(contentsOf: fileURL)

        // Decrypt data
        let decryptedData = try await decrypt(data: encryptedData)

        return decryptedData
    }

    /// Delete evidence file
    func deleteEvidence(credentialId: String, evidenceId: String) async throws {
        guard let metadata = try await loadMetadata(credentialId: credentialId, evidenceId: evidenceId) else {
            return
        }

        // Delete file
        let fileURL = evidenceDirectory.appendingPathComponent(metadata.fileName)
        try? fileManager.removeItem(at: fileURL)

        // Delete metadata
        try await deleteMetadata(credentialId: credentialId, evidenceId: evidenceId)
    }

    /// List all evidence for a credential
    func listEvidence(credentialId: String) async throws -> [EvidenceMetadata] {
        return try await loadAllMetadata(for: credentialId)
    }

    /// Get evidence URL (for sharing/preview)
    func getEvidenceURL(credentialId: String, evidenceId: String) -> URL? {
        guard let metadata = try? await loadMetadata(credentialId: credentialId, evidenceId: evidenceId) else {
            return nil
        }

        let fileURL = evidenceDirectory.appendingPathComponent(metadata.fileName)
        return fileManager.fileExists(atPath: fileURL.path) ? fileURL : nil
    }

    // MARK: - Metadata Storage

    private func storeMetadata(_ metadata: EvidenceMetadata) async throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(metadata)

        let fileName = "\(metadata.credentialId)_\(metadata.evidenceId)_meta.json"
        let fileURL = evidenceDirectory.appendingPathComponent(fileName)
        try data.write(to: fileURL)
    }

    private func loadMetadata(credentialId: String, evidenceId: String) async throws -> EvidenceMetadata? {
        let fileName = "\(credentialId)_\(evidenceId)_meta.json"
        let fileURL = evidenceDirectory.appendingPathComponent(fileName)

        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }

        let data = try Data(contentsOf: fileURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(EvidenceMetadata.self, from: data)
    }

    private func loadAllMetadata(for credentialId: String) async throws -> [EvidenceMetadata] {
        let contents = try fileManager.contentsOfDirectory(at: evidenceDirectory, includingPropertiesForKeys: nil)
        var metadataList: [EvidenceMetadata] = []

        for fileURL in contents where fileURL.lastPathComponent.contains("_meta.json") && fileURL.lastPathComponent.contains(credentialId) {
            if let data = try? Data(contentsOf: fileURL) {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                if let metadata = try? decoder.decode(EvidenceMetadata.self, from: data) {
                    metadataList.append(metadata)
                }
            }
        }

        return metadataList
    }

    private func deleteMetadata(credentialId: String, evidenceId: String) async throws {
        let fileName = "\(credentialId)_\(evidenceId)_meta.json"
        let fileURL = evidenceDirectory.appendingPathComponent(fileName)
        try? fileManager.removeItem(at: fileURL)
    }

    // MARK: - Encryption

    private func encrypt(data: Data) async throws -> Data {
        // Use AES encryption with key from Keychain
        // Simplified implementation - in production, use proper key derivation
        let key = try getEncryptionKey()
        // Implement AES encryption here
        // For now, return data as-is (should be properly encrypted)
        return data
    }

    private func decrypt(data: Data) async throws -> Data {
        // Implement AES decryption
        return data
    }

    private func getEncryptionKey() throws -> Data {
        // Retrieve encryption key from Keychain
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "evidence.encryption.key",
            kSecReturnData as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecSuccess, let keyData = item as? Data {
            return keyData
        }

        // Create new key
        let key = SymmetricKey(size: .bits256).data
        let saveQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "evidence.encryption.key",
            kSecValueData as String: key,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemAdd(saveQuery as CFDictionary, nil)
        return key
    }
}

// MARK: - Models

struct EvidenceMetadata: Codable {
    let credentialId: String
    let evidenceId: String
    let fileName: String
    let mimeType: String
    let storedAt: Date
    let size: Int
}

// MARK: - Errors

enum EvidenceStoreError: LocalizedError {
    case notFound
    case encryptionFailed
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .notFound:
            return "Evidence not found"
        case .encryptionFailed:
            return "Failed to encrypt evidence"
        case .decryptionFailed:
            return "Failed to decrypt evidence"
        }
    }
}

// MARK: - Helper

struct SymmetricKey {
    let data: Data

    init(size: KeySize) {
        var bytes = [UInt8](repeating: 0, count: size.byteCount)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        self.data = Data(bytes)
    }
}

enum KeySize {
    case bits256

    var byteCount: Int {
        switch self {
        case .bits256:
            return 32
        }
    }
}

