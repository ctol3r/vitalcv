//
//  ClipProofEngine.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 3 - Task 17
//  Clipped ProofEngine with reduced footprint for App Clip
//

import Foundation
import CryptoKit

/// Lightweight ProofEngine for App Clip - reduced footprint
@MainActor
public class ClipProofEngine {
    public static let shared = ClipProofEngine()

    private let networkService = ClipNetworkService.shared

    private init() {}

    // MARK: - Task 18: Local Signature Validation

    /// Verify JWT signature locally using CryptoKit
    public func verifyJWTSignature(_ jwt: String, publicKey: P256.Signing.PublicKey) throws -> Bool {
        let parts = jwt.components(separatedBy: ".")
        guard parts.count == 3 else {
            throw ClipVerificationError.invalidJWTFormat
        }

        let header = parts[0]
        let payload = parts[1]
        let signature = parts[2]

        // Reconstruct message
        let message = "\(header).\(payload)".data(using: .utf8)!

        // Decode signature
        guard let signatureData = Data(base64URLEncoded: signature) else {
            throw ClipVerificationError.invalidSignature
        }

        // Verify signature
        let signatureWrapper = try P256.Signing.ECDSASignature(derRepresentation: signatureData)
        return publicKey.isValidSignature(signatureWrapper, for: message)
    }

    /// Verify ES256 signature (simplified for App Clip)
    public func verifyES256Signature(jwt: String, issuerDID: String) async throws -> Bool {
        // Task 19: Limited DID resolution via backend
        guard let publicKey = try await resolveIssuerPublicKey(issuerDID: issuerDID) else {
            return false
        }

        return try verifyJWTSignature(jwt, publicKey: publicKey)
    }

    // MARK: - Task 19: Limited DID Resolution

    private func resolveIssuerPublicKey(issuerDID: String) async throws -> P256.Signing.PublicKey? {
        // Backend-weighted DID resolution
        let endpoint = "/api/did/resolve?did=\(issuerDID)"

        do {
            let response: DIDResolutionResponse = try await networkService.get(endpoint: endpoint)

            // Extract public key from DID document
            guard let publicKeyJWK = response.didDocument?.verificationMethod?.first?.publicKeyJwk else {
                return nil
            }

            // Convert JWK to CryptoKit public key
            return try jwkToPublicKey(jwk: publicKeyJWK)
        } catch {
            // Fallback: return nil if resolution fails
            return nil
        }
    }

    private func jwkToPublicKey(jwk: [String: Any]) throws -> P256.Signing.PublicKey {
        // Simplified JWK to CryptoKit conversion
        // In production, this would handle full JWK format
        guard let x = jwk["x"] as? String,
              let y = jwk["y"] as? String,
              let xData = Data(base64URLEncoded: x),
              let yData = Data(base64URLEncoded: y) else {
            throw ClipVerificationError.invalidPublicKey
        }

        // Construct P256 public key from x, y coordinates
        var keyData = Data()
        keyData.append(0x04) // Uncompressed point indicator
        keyData.append(xData)
        keyData.append(yData)

        return try P256.Signing.PublicKey(derRepresentation: keyData)
    }

    // MARK: - Task 20: No-Login Trust Evaluation

    /// Evaluate trust without requiring login
    public func evaluateTrust(
        issuerDID: String,
        chainAnchor: ChainAnchorStatus?,
        evidenceDigest: String?
    ) async throws -> TrustEvaluation {
        // Issuer trust check
        let issuerTrust = try await checkIssuerTrust(issuerDID: issuerDID)

        // Chain anchor check
        let chainTrust = chainAnchor?.confirmed == true ? 0.9 : 0.0

        // Evidence digest check
        let evidenceTrust = evidenceDigest != nil ? 0.8 : 0.0

        // Composite trust score
        let trustScore = (issuerTrust * 0.4) + (chainTrust * 0.4) + (evidenceTrust * 0.2)

        return TrustEvaluation(
            issuerTrust: issuerTrust,
            chainTrust: chainTrust,
            evidenceTrust: evidenceTrust,
            overallTrust: trustScore,
            trusted: trustScore >= 0.7
        )
    }

    private func checkIssuerTrust(issuerDID: String) async throws -> Double {
        // Backend-weighted trust check
        let endpoint = "/api/trust/issuer?did=\(issuerDID)"

        do {
            let response: IssuerTrustResponse = try await networkService.get(endpoint: endpoint)
            return response.trustScore
        } catch {
            // Default to low trust if check fails
            return 0.3
        }
    }
}

// MARK: - Supporting Types

struct DIDResolutionResponse: Codable {
    let didDocument: DIDDocument?

    struct DIDDocument: Codable {
        let verificationMethod: [VerificationMethod]?

        struct VerificationMethod: Codable {
            let publicKeyJwk: [String: String]?
        }
    }
}

struct IssuerTrustResponse: Codable {
    let trustScore: Double
    let trusted: Bool
}

struct TrustEvaluation {
    let issuerTrust: Double
    let chainTrust: Double
    let evidenceTrust: Double
    let overallTrust: Double
    let trusted: Bool
}

enum ClipVerificationError: Error, LocalizedError {
    case invalidJWTFormat
    case invalidSignature
    case invalidPublicKey

    var errorDescription: String? {
        switch self {
        case .invalidJWTFormat:
            return "Invalid JWT format"
        case .invalidSignature:
            return "Invalid signature"
        case .invalidPublicKey:
            return "Invalid public key"
        }
    }
}




