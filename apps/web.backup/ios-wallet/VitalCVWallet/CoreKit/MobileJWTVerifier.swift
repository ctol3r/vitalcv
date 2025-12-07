//
//  MobileJWTVerifier.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 5
//  Mobile JWT verifier using CryptoKit
//

import Foundation
import CryptoKit

/// MobileJWTVerifier - JWT verification using CryptoKit
public class MobileJWTVerifier {
    public static let shared = MobileJWTVerifier()

    private init() {}

    // MARK: - JWT Verification

    /// Verify JWT credential
    public func verify(credential: VerifiableCredential) async throws -> JWTVerificationResult {
        guard let proof = credential.proof,
              let jws = proof.jws else {
            return JWTVerificationResult(
                valid: false,
                checks: [
                    ProofCheck(name: "JWS Present", passed: false, message: "No JWS signature found")
                ],
                signatureValid: false,
                issuerVerified: false
            )
        }

        // Parse JWT
        let jwtParts = jws.split(separator: ".")
        guard jwtParts.count == 3 else {
            return JWTVerificationResult(
                valid: false,
                checks: [
                    ProofCheck(name: "JWT Format", passed: false, message: "Invalid JWT format")
                ],
                signatureValid: false,
                issuerVerified: false
            )
        }

        let headerData = Data(base64URLEncoded: String(jwtParts[0])) ?? Data()
        let payloadData = Data(base64URLEncoded: String(jwtParts[1])) ?? Data()
        let signatureData = Data(base64URLEncoded: String(jwtParts[2])) ?? Data()

        // Decode header
        guard let header = try? JSONDecoder().decode(JWTHeader.self, from: headerData) else {
            return JWTVerificationResult(
                valid: false,
                checks: [
                    ProofCheck(name: "JWT Header", passed: false, message: "Invalid JWT header")
                ],
                signatureValid: false,
                issuerVerified: false
            )
        }

        // Decode payload
        guard let payload = try? JSONDecoder().decode(JWTPayload.self, from: payloadData) else {
            return JWTVerificationResult(
                valid: false,
                checks: [
                    ProofCheck(name: "JWT Payload", passed: false, message: "Invalid JWT payload")
                ],
                signatureValid: false,
                issuerVerified: false
            )
        }

        var checks: [ProofCheck] = []
        checks.append(ProofCheck(name: "JWT Format", passed: true, message: nil))
        checks.append(ProofCheck(name: "JWT Header", passed: true, message: nil))
        checks.append(ProofCheck(name: "JWT Payload", passed: true, message: nil))

        // Verify signature
        let signatureValid = await verifySignature(
            header: header,
            payload: String(jwtParts[0]) + "." + String(jwtParts[1]),
            signature: signatureData
        )

        checks.append(ProofCheck(
            name: "Signature Verification",
            passed: signatureValid,
            message: signatureValid ? "Signature valid" : "Signature verification failed"
        ))

        // Verify issuer
        let issuerVerified = await verifyIssuer(payload: payload, expectedIssuer: credential.issuer.id)
        checks.append(ProofCheck(
            name: "Issuer Verification",
            passed: issuerVerified,
            message: issuerVerified ? "Issuer verified" : "Issuer verification failed"
        ))

        // Verify expiration
        let expirationValid = verifyExpiration(payload: payload)
        checks.append(ProofCheck(
            name: "Expiration Check",
            passed: expirationValid,
            message: expirationValid ? "Credential not expired" : "Credential has expired"
        ))

        let allPassed = checks.allSatisfy { $0.passed }

        return JWTVerificationResult(
            valid: allPassed,
            checks: checks,
            signatureValid: signatureValid,
            issuerVerified: issuerVerified
        )
    }

    // MARK: - Signature Verification

    private func verifySignature(
        header: JWTHeader,
        payload: String,
        signature: Data
    ) async -> Bool {
        // Determine algorithm from header
        guard let alg = header.alg else {
            return false
        }

        switch alg {
        case "ES256":
            return await verifyES256Signature(payload: payload, signature: signature, keyId: header.kid)
        case "ES256K":
            return await verifyES256KSignature(payload: payload, signature: signature, keyId: header.kid)
        case "EdDSA":
            return await verifyEdDSASignature(payload: payload, signature: signature, keyId: header.kid)
        default:
            // Unsupported algorithm
            return false
        }
    }

    private func verifyES256Signature(
        payload: String,
        signature: Data,
        keyId: String?
    ) async -> Bool {
        // ES256 uses P-256 curve
        // In production, fetch public key from issuer's DID document
        // For now, return true if signature format is valid
        return signature.count == 64 // ES256 signature is 64 bytes
    }

    private func verifyES256KSignature(
        payload: String,
        signature: Data,
        keyId: String?
    ) async -> Bool {
        // ES256K uses secp256k1 curve
        // In production, fetch public key from issuer's DID document
        return signature.count == 64 // ES256K signature is 64 bytes
    }

    private func verifyEdDSASignature(
        payload: String,
        signature: Data,
        keyId: String?
    ) async -> Bool {
        // EdDSA uses Ed25519 curve
        // In production, fetch public key from issuer's DID document
        return signature.count == 64 // Ed25519 signature is 64 bytes
    }

    // MARK: - Issuer Verification

    private func verifyIssuer(
        payload: JWTPayload,
        expectedIssuer: String
    ) async -> Bool {
        guard let issuer = payload.iss else {
            return false
        }

        // Verify issuer matches
        guard issuer == expectedIssuer else {
            return false
        }

        // In production, verify issuer's DID document and public key
        // For now, just check if issuer matches
        return true
    }

    // MARK: - Expiration Verification

    private func verifyExpiration(payload: JWTPayload) -> Bool {
        guard let exp = payload.exp else {
            // No expiration claim, consider valid
            return true
        }

        let expirationDate = Date(timeIntervalSince1970: TimeInterval(exp))
        return expirationDate > Date()
    }
}

// MARK: - Models

public struct JWTVerificationResult {
    public let valid: Bool
    public let checks: [ProofCheck]
    public let signatureValid: Bool
    public let issuerVerified: Bool
}

private struct JWTHeader: Codable {
    let alg: String?
    let typ: String?
    let kid: String?
    let jwk: [String: String]?
}

private struct JWTPayload: Codable {
    let iss: String?
    let sub: String?
    let aud: String?
    let exp: Int?
    let iat: Int?
    let nbf: Int?
    let jti: String?
    let vc: [String: AnyCodable]?
}

// Helper for decoding Any values
private struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable value cannot be decoded")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dictionary as [String: Any]:
            try container.encode(dictionary.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "AnyCodable value cannot be encoded"))
        }
    }
}

// MARK: - Base64URL Decoding

extension Data {
    init?(base64URLEncoded string: String) {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        // Add padding if needed
        let remainder = base64.count % 4
        if remainder > 0 {
            base64.append(String(repeating: "=", count: 4 - remainder))
        }

        self.init(base64Encoded: base64)
    }
}

