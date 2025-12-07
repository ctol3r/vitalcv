//
//  KeychainService.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 4
//  Secure local storage using Keychain
//

import Foundation
import Security

class KeychainService {
    static let shared = KeychainService()

    private let service = "com.vitalcv.wallet"
    private let didKey = "user.did"
    private let credentialsKey = "wallet.credentials"
    private let pinKey = "user.pin.hash"

    private init() {}

    // MARK: - DID Management

    func saveDID(_ did: String) -> Bool {
        return save(data: did.data(using: .utf8)!, key: didKey)
    }

    func loadDID() -> String? {
        guard let data = load(key: didKey),
              let did = String(data: data, encoding: .utf8) else {
            return nil
        }
        return did
    }

    func deleteDID() -> Bool {
        return delete(key: didKey)
    }

    // MARK: - Credentials Storage

    func saveCredentials(_ data: Data) -> Bool {
        return save(data: data, key: credentialsKey)
    }

    func loadCredentials() -> Data? {
        return load(key: credentialsKey)
    }

    func deleteCredentials() -> Bool {
        return delete(key: credentialsKey)
    }

    // MARK: - PIN Management

    func savePINHash(_ hash: String) -> Bool {
        return save(data: hash.data(using: .utf8)!, key: pinKey)
    }

    func loadPINHash() -> String? {
        guard let data = load(key: pinKey),
              let hash = String(data: data, encoding: .utf8) else {
            return nil
        }
        return hash
    }

    func deletePINHash() -> Bool {
        return delete(key: pinKey)
    }

    // MARK: - Generic Keychain Operations

    private func save(data: Data, key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        // Delete existing item first
        SecItemDelete(query as CFDictionary)

        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    private func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data else {
            return nil
        }

        return data
    }

    private func delete(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    // MARK: - Generic Data Operations

    func save(_ value: String, key: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        return saveGeneric(data: data, key: key)
    }

    func load(_ key: String) -> String? {
        guard let data = loadGeneric(key: key),
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        return value
    }

    // MARK: - Helper Methods for Generic Data

    private func saveGeneric(data: Data, key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    private func loadGeneric(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data else {
            return nil
        }

        return data
    }

    private func deleteGeneric(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    // MARK: - Backup Reference Management (Task 8)

    func saveBackupReference(_ reference: BackupReference) -> Bool {
        guard let data = try? JSONEncoder().encode(reference) else {
            return false
        }
        return save(data: data, key: "backup.reference")
    }

    func loadBackupReference() -> BackupReference? {
        guard let data = load(key: "backup.reference"),
              let reference = try? JSONDecoder().decode(BackupReference.self, from: data) else {
            return nil
        }
        return reference
    }

    func deleteBackupReference() -> Bool {
        return delete(key: "backup.reference")
    }
}

