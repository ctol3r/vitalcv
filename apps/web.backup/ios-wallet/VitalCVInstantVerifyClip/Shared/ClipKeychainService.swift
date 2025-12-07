//
//  ClipKeychainService.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 1 - Task 6
//  Lightweight Keychain wrapper with limited storage for App Clip
//

import Foundation
import Security

/// Lightweight Keychain service for App Clip - session-only storage
class ClipKeychainService {
    static let shared = ClipKeychainService()

    private let service = "com.vitalcv.clip"
    private let sessionKeyPrefix = "session."

    private init() {}

    // MARK: - Session-Only Storage (Task 26)

    /// Save session data (automatically cleared when App Clip terminates)
    func saveSessionData(_ data: Data, key: String) -> Bool {
        let fullKey = sessionKeyPrefix + key
        return save(data: data, key: fullKey, accessible: .whenUnlocked)
    }

    func loadSessionData(key: String) -> Data? {
        let fullKey = sessionKeyPrefix + key
        return load(key: fullKey)
    }

    func deleteSessionData(key: String) -> Bool {
        let fullKey = sessionKeyPrefix + key
        return delete(key: fullKey)
    }

    /// Clear all session data
    func clearAllSessionData() {
        // Delete all keys with session prefix
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]

        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Generic Keychain Operations

    private func save(data: Data, key: String, accessible: CFString) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: accessible
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
}




