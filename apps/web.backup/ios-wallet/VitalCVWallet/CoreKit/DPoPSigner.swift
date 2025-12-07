//
//  DPoPSigner.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 11
//  Updated: Batch 136-A - Task 1 (use DPoPKeyManager)
//  DPoP signing using CryptoKit with key rotation
//

import Foundation
import CryptoKit

/// DPoPSigner - Demonstrating Proof-of-Possession signing
public class DPoPSigner {
    public static let shared = DPoPSigner()

    private init() {}

    // MARK: - DPoP Token Generation

    /// Generate DPoP proof token for HTTP request
    public func generateDPoPToken(
        method: String,
        url: URL,
        accessToken: String? = nil
    ) throws -> String {
        // Use DPoPKeyManager for key management with rotation
        let privateKey = try DPoPKeyManager.shared.getCurrentKey()

        let now = Date()
        let iat = Int(now.timeIntervalSince1970)
        let jti = UUID().uuidString

        // Build JWT header
        let header: [String: Any] = [
            "typ": "dpop+jwt",
            "alg": "ES256",
            "jwk": publicKeyJWK()
        ]

        // Build JWT payload
        var payload: [String: Any] = [
            "iat": iat,
            "jti": jti,
            "htm": method.uppercased(),
            "htu": url.absoluteString
        ]

        if let ath = accessToken {
            // Hash access token for binding
            let athHash = SHA256.hash(data: Data(ath.utf8))
            payload["ath"] = athHash.compactMap { String(format: "%02x", $0) }.joined()
        }

        // Encode header and payload
        let headerData = try JSONSerialization.data(withJSONObject: header)
        let payloadData = try JSONSerialization.data(withJSONObject: payload)

        let headerBase64 = headerData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        let payloadBase64 = payloadData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        // Create signature
        let message = "\(headerBase64).\(payloadBase64)".data(using: .utf8)!
        let signature = try privateKey.signature(for: message)
        let signatureData = signature.rawRepresentation

        let signatureBase64 = signatureData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        return "\(headerBase64).\(payloadBase64).\(signatureBase64)"
    }

    // MARK: - Public Key JWK

    private func publicKeyJWK() -> [String: String] {
        // Use DPoPKeyManager to get public key JWK
        do {
            return try DPoPKeyManager.shared.getPublicKeyJWK()
        } catch {
            return [:]
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

public enum DPoPError: Error {
    case missingPrivateKey
    case signingFailed
}

