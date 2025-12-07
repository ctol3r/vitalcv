//
//  DIDService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 8
//  DID creation and management service
//

import Foundation

class DIDService {
    static let shared = DIDService()

    private init() {}

    /// Create a new DID automatically on first open
    func createDID() async throws -> String {
        // Generate a new DID using did:key method
        // Format: did:key:z<base58-encoded-public-key>

        // Generate a key pair (simplified - in production use proper crypto)
        let keyMaterial = generateKeyMaterial()
        let did = "did:key:\(keyMaterial)"

        // Store in Keychain
        if !KeychainService.shared.saveDID(did) {
            throw DIDError.saveFailed
        }

        return did
    }

    /// Load existing DID from Keychain
    func loadDID() -> String? {
        return KeychainService.shared.loadDID()
    }

    /// Check if DID exists
    func hasDID() -> Bool {
        return loadDID() != nil
    }

    /// Generate or load existing DID
    func getOrCreateDID() async throws -> String {
        if let existing = loadDID() {
            return existing
        }
        return try await createDID()
    }

    private func generateKeyMaterial() -> String {
        // Generate random bytes (32 bytes = 256 bits)
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)

        guard status == errSecSuccess else {
            // Fallback to UUID-based identifier
            return UUID().uuidString.replacingOccurrences(of: "-", with: "")
        }

        // Convert to base58-like string (simplified)
        let hexString = bytes.map { String(format: "%02x", $0) }.joined()
        return String(hexString.prefix(32))
    }
}

enum DIDError: Error {
    case saveFailed
    case invalidDID
}








