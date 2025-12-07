//
//  CredentialStore.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 11
//  CredentialStore: Keychain + encrypted JSON storage
//

import Foundation
import Security

/// CredentialStore - Secure credential storage using Keychain + encrypted JSON
/// Provides encrypted storage for verifiable credentials
@MainActor
class CredentialStore: ObservableObject {
    static let shared = CredentialStore()

    private let keychain = KeychainService.shared
    private let encryptionKeyTag = "com.vitalcv.credential.encryption.key"

    @Published private(set) var credentials: [VerifiableCredential] = []
    @Published private(set) var isLoaded: Bool = false

    private init() {
        Task {
            await loadCredentials()
        }
    }

    // MARK: - Public API

    /// Load all credentials from storage
    func loadCredentials() async {
        guard let encryptedData = keychain.loadCredentials() else {
            isLoaded = true
            return
        }

        do {
            // Decrypt credentials
            let decryptedData = try await decrypt(data: encryptedData)

            // Decode credentials
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            credentials = try decoder.decode([VerifiableCredential].self, from: decryptedData)

            isLoaded = true
        } catch {
            print("Failed to load credentials: \(error)")
            // Clear corrupted data
            credentials = []
            isLoaded = true
        }
    }

    /// Save a credential
    func saveCredential(_ credential: VerifiableCredential) async throws {
        // Add or update credential
        if let index = credentials.firstIndex(where: { $0.id == credential.id }) {
            credentials[index] = credential
        } else {
            credentials.append(credential)
        }

        // Persist to storage
        try await persistCredentials()
    }

    /// Delete a credential
    func deleteCredential(_ credentialId: String) async throws {
        credentials.removeAll { $0.id == credentialId }
        try await persistCredentials()
    }

    /// Get credential by ID
    func getCredential(id: String) -> VerifiableCredential? {
        return credentials.first { $0.id == id }
    }

    /// Get all credentials
    func getAllCredentials() -> [VerifiableCredential] {
        return credentials
    }

    /// Update credential
    func updateCredential(_ credential: VerifiableCredential) async throws {
        guard let index = credentials.firstIndex(where: { $0.id == credential.id }) else {
            throw CredentialStoreError.credentialNotFound
        }

        credentials[index] = credential
        try await persistCredentials()
    }

    // MARK: - Private Methods

    private func persistCredentials() async throws {
        // Encode credentials
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        let jsonData = try encoder.encode(credentials)

        // Encrypt data
        let encryptedData = try await encrypt(data: jsonData)

        // Save to Keychain
        keychain.saveCredentials(encryptedData)
    }

    // MARK: - Encryption

    private func getEncryptionKey() throws -> SecKey {
        // Try to retrieve existing key
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: encryptionKeyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecSuccess, let key = item as! SecKey? {
            return key
        }

        // Create new key if not found
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
            kSecAttrKeySizeInBits as String: 2048,
            kSecAttrApplicationTag as String: encryptionKeyTag,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrAccessControl as String: SecAccessControlCreateWithFlags(
                    kCFAllocatorDefault,
                    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                    [],
                    nil
                ) as Any
            ]
        ]

        var error: Unmanaged<CFError>?
        guard let key = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw CredentialStoreError.encryptionKeyCreationFailed
        }

        return key
    }

    private func encrypt(data: Data) async throws -> Data {
        let key = try getEncryptionKey()

        var error: Unmanaged<CFError>?
        guard let encryptedData = SecKeyCreateEncryptedData(
            key,
            .rsaEncryptionPKCS1,
            data as CFData,
            &error
        ) as Data? else {
            throw error?.takeRetainedValue() ?? CredentialStoreError.encryptionFailed
        }

        return encryptedData
    }

    private func decrypt(data: Data) async throws -> Data {
        let key = try getEncryptionKey()

        var error: Unmanaged<CFError>?
        guard let decryptedData = SecKeyCreateDecryptedData(
            key,
            .rsaEncryptionPKCS1,
            data as CFData,
            &error
        ) as Data? else {
            throw error?.takeRetainedValue() ?? CredentialStoreError.decryptionFailed
        }

        return decryptedData
    }
}

// MARK: - Errors

enum CredentialStoreError: LocalizedError {
    case credentialNotFound
    case encryptionKeyCreationFailed
    case encryptionFailed
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .credentialNotFound:
            return "Credential not found"
        case .encryptionKeyCreationFailed:
            return "Failed to create encryption key"
        case .encryptionFailed:
            return "Failed to encrypt credential data"
        case .decryptionFailed:
            return "Failed to decrypt credential data"
        }
    }
}

