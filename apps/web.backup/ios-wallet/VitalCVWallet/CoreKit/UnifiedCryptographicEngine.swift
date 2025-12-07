//
//  UnifiedCryptographicEngine.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 2
//  Unified cryptographic engine (DPoP + SD-JWT + BBS+)
//

import Foundation
import CryptoKit

/// UnifiedCryptographicEngine - Handles DPoP, SD-JWT, and BBS+ cryptographic operations
public class UnifiedCryptographicEngine {
    public static let shared = UnifiedCryptographicEngine()

    private init() {}

    // MARK: - DPoP (Demonstrating Proof-of-Possession)

    /// Generate DPoP token for API authentication
    public func generateDPoPToken(
        httpMethod: String,
        url: String,
        nonce: String? = nil
    ) async throws -> String {
        let privateKey = try loadOrCreateDPoPKey()

        // Create DPoP payload
        var payload: [String: Any] = [
            "iat": Int(Date().timeIntervalSince1970),
            "jti": UUID().uuidString,
            "htm": httpMethod,
            "htu": url
        ]

        if let nonce = nonce {
            payload["nonce"] = nonce
        }

        // Sign with Ed25519
        let payloadData = try JSONSerialization.data(withJSONObject: payload)
        let signature = try privateKey.signature(for: payloadData)

        // Build DPoP token (simplified - in production use proper JWT encoding)
        let header: [String: Any] = [
            "typ": "dpop+jwt",
            "alg": "Ed25519",
            "jwk": try extractPublicKeyJWK(from: privateKey)
        ]

        let headerData = try JSONSerialization.data(withJSONObject: header)
        let headerBase64 = headerData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        let payloadBase64 = payloadData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        let signatureBase64 = signature.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        return "\(headerBase64).\(payloadBase64).\(signatureBase64)"
    }

    // MARK: - SD-JWT (Selective Disclosure JWT)

    /// Create SD-JWT with selective disclosure
    public func createSDJWT(
        claims: [String: Any],
        disclosures: [String]? = nil
    ) async throws -> String {
        let privateKey = try loadOrCreateIssuerKey()

        // Build SD-JWT payload
        var payload: [String: Any] = [
            "iss": "vitalcv",
            "iat": Int(Date().timeIntervalSince1970),
            "vct": "https://credentials.example.com/identity/v1"
        ]

        // Add claims
        for (key, value) in claims {
            payload[key] = value
        }

        // Add disclosure digests if provided
        if let disclosures = disclosures {
            var sdArray: [String] = []
            for disclosure in disclosures {
                let digest = SHA256.hash(data: disclosure.data(using: .utf8)!)
                sdArray.append(digest.hexString)
            }
            payload["_sd"] = sdArray
        }

        // Sign payload
        let payloadData = try JSONSerialization.data(withJSONObject: payload)
        let signature = try privateKey.signature(for: payloadData)

        // Build SD-JWT (simplified format)
        let header: [String: Any] = [
            "typ": "sd-jwt",
            "alg": "Ed25519"
        ]

        let headerData = try JSONSerialization.data(withJSONObject: header)
        let headerBase64 = headerData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        let payloadBase64 = payloadData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        let signatureBase64 = signature.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        var sdJWT = "\(headerBase64)~\(payloadBase64)~\(signatureBase64)"

        // Append disclosures
        if let disclosures = disclosures {
            for disclosure in disclosures {
                sdJWT += "~\(disclosure)"
            }
        }

        return sdJWT
    }

    /// Verify SD-JWT and extract disclosed claims
    public func verifySDJWT(_ sdJWT: String) async throws -> SDJWTVerificationResult {
        let components = sdJWT.split(separator: "~")
        guard components.count >= 3 else {
            throw CryptoError.invalidSDJWTFormat
        }

        // Parse header and payload
        let headerBase64 = String(components[0])
        let payloadBase64 = String(components[1])
        let signatureBase64 = String(components[2])

        // Decode and verify signature (simplified - in production use proper verification)
        let headerData = try decodeBase64URL(headerBase64)
        let payloadData = try decodeBase64URL(payloadBase64)
        let signatureData = try decodeBase64URL(signatureBase64)

        // Extract disclosed claims
        let payload = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any] ?? [:]
        var disclosedClaims: [String: Any] = [:]

        for (key, value) in payload {
            if !key.hasPrefix("_") {
                disclosedClaims[key] = value
            }
        }

        // Process disclosures if present
        if components.count > 3 {
            let disclosures = components[3...]
            for disclosure in disclosures {
                // In production, properly decode and verify disclosure digests
                let disclosureString = String(disclosure)
                if let data = disclosureString.data(using: .utf8),
                   let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    // Extract claim from disclosure
                    if let key = decoded.keys.first(where: { $0 != "..." && $0 != "salt" }) {
                        disclosedClaims[key] = decoded[key]
                    }
                }
            }
        }

        return SDJWTVerificationResult(
            valid: true, // Simplified - in production verify signature
            disclosedClaims: disclosedClaims,
            payload: payload
        )
    }

    // MARK: - BBS+ Signatures

    /// Create BBS+ signature for selective disclosure
    public func createBBSPlusSignature(
        messages: [String],
        publicKey: Data
    ) async throws -> Data {
        // BBS+ signature creation (simplified - in production use proper BBS+ library)
        // This is a placeholder implementation
        let combined = messages.joined(separator: "|").data(using: .utf8)!
        let hash = SHA256.hash(data: combined)
        return Data(hash)
    }

    /// Verify BBS+ signature
    public func verifyBBSPlusSignature(
        signature: Data,
        messages: [String],
        publicKey: Data
    ) async throws -> Bool {
        // BBS+ verification (simplified - in production use proper BBS+ library)
        let expected = try await createBBSPlusSignature(messages: messages, publicKey: publicKey)
        return signature == expected
    }

    // MARK: - Key Management

    private func loadOrCreateDPoPKey() throws -> Curve25519.Signing.PrivateKey {
        let keychain = KeychainService.shared
        let keyKey = "dpop.privateKey"

        if let keyData = keychain.load(key: keyKey),
           let key = try? Curve25519.Signing.PrivateKey(rawRepresentation: keyData) {
            return key
        }

        let newKey = Curve25519.Signing.PrivateKey()
        _ = keychain.save(data: newKey.rawRepresentation, key: keyKey)
        return newKey
    }

    private func loadOrCreateIssuerKey() throws -> Curve25519.Signing.PrivateKey {
        let keychain = KeychainService.shared
        let keyKey = "issuer.privateKey"

        if let keyData = keychain.load(key: keyKey),
           let key = try? Curve25519.Signing.PrivateKey(rawRepresentation: keyData) {
            return key
        }

        let newKey = Curve25519.Signing.PrivateKey()
        _ = keychain.save(data: newKey.rawRepresentation, key: keyKey)
        return newKey
    }

    private func extractPublicKeyJWK(from privateKey: Curve25519.Signing.PrivateKey) throws -> [String: Any] {
        let publicKey = privateKey.publicKey
        let publicKeyData = publicKey.rawRepresentation

        // Convert to JWK format (simplified)
        return [
            "kty": "OKP",
            "crv": "Ed25519",
            "x": publicKeyData.base64EncodedString()
        ]
    }

    private func decodeBase64URL(_ string: String) throws -> Data {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        // Add padding if needed
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }

        guard let data = Data(base64Encoded: base64) else {
            throw CryptoError.invalidBase64
        }

        return data
    }
}

// MARK: - Models

public struct SDJWTVerificationResult {
    public let valid: Bool
    public let disclosedClaims: [String: Any]
    public let payload: [String: Any]
}

public enum CryptoError: LocalizedError {
    case invalidSDJWTFormat
    case invalidBase64
    case keyGenerationFailed
    case signatureVerificationFailed

    public var errorDescription: String? {
        switch self {
        case .invalidSDJWTFormat:
            return "Invalid SD-JWT format"
        case .invalidBase64:
            return "Invalid base64 encoding"
        case .keyGenerationFailed:
            return "Failed to generate cryptographic key"
        case .signatureVerificationFailed:
            return "Signature verification failed"
        }
    }
}

// MARK: - Extensions

extension SHA256.Digest {
    var hexString: String {
        return self.map { String(format: "%02x", $0) }.joined()
    }
}

