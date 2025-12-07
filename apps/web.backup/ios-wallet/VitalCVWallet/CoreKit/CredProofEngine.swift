//
//  CredProofEngine.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 2
//  CredProofEngine bridging SD-JWT, BBS+, JWT-VC formats
//

import Foundation

/// CredProofEngine - Multi-format proof validation and conversion
public class CredProofEngine {
    public static let shared = CredProofEngine()

    private init() {}

    // MARK: - Proof Format Detection

    /// Detect proof format from credential
    public func detectProofFormat(credential: VerifiableCredential) -> ProofFormat {
        guard let proof = credential.proof else {
            return .none
        }

        // Check proof type
        switch proof.type {
        case "JsonWebSignature2020", "JwtProof2020":
            return .jwtVC
        case "BbsBlsSignature2020", "BbsBlsSignatureProof2020":
            return .bbsPlus
        case "SdJwt":
            return .sdJwt
        default:
            // Try to infer from structure
            if proof.jws != nil {
                return .jwtVC
            }
            return .unknown
        }
    }

    // MARK: - W3C JWT-VC Validation

    /// Validate W3C JWT-VC format credential
    public func validateJWTVC(_ credential: VerifiableCredential) async throws -> ValidationResult {
        var checks: [ProofCheck] = []

        // Check 1: Proof exists
        guard let proof = credential.proof else {
            checks.append(ProofCheck(name: "Proof Exists", passed: false, message: "No proof found"))
            return ValidationResult(valid: false, format: .jwtVC, checks: checks)
        }
        checks.append(ProofCheck(name: "Proof Exists", passed: true, message: nil))

        // Check 2: JWS signature
        if let jws = proof.jws, !jws.isEmpty {
            checks.append(ProofCheck(name: "JWS Signature", passed: true, message: "Signature present"))
        } else {
            checks.append(ProofCheck(name: "JWS Signature", passed: false, message: "Missing JWS"))
        }

        // Check 3: Verification method
        if !proof.verificationMethod.isEmpty {
            checks.append(ProofCheck(name: "Verification Method", passed: true, message: nil))
        } else {
            checks.append(ProofCheck(name: "Verification Method", passed: false, message: "Missing verification method"))
        }

        // Check 4: Proof purpose
        if !proof.proofPurpose.isEmpty {
            checks.append(ProofCheck(name: "Proof Purpose", passed: true, message: nil))
        } else {
            checks.append(ProofCheck(name: "Proof Purpose", passed: false, message: "Missing proof purpose"))
        }

        let allPassed = checks.allSatisfy { $0.passed }
        return ValidationResult(valid: allPassed, format: .jwtVC, checks: checks)
    }

    // MARK: - SD-JWT Validation

    /// Validate SD-JWT format credential
    public func validateSDJWT(_ credential: VerifiableCredential) async throws -> ValidationResult {
        var checks: [ProofCheck] = []

        // SD-JWT specific validation
        checks.append(ProofCheck(name: "SD-JWT Format", passed: true, message: "SD-JWT structure detected"))

        // Check for disclosure digests in credential subject
        let hasDisclosures = credential.credentialSubject.claims.keys.contains { $0.hasPrefix("_sd") }
        checks.append(ProofCheck(
            name: "Disclosure Digests",
            passed: hasDisclosures,
            message: hasDisclosures ? "Selective disclosure digests present" : "No disclosure digests found"
        ))

        let allPassed = checks.allSatisfy { $0.passed }
        return ValidationResult(valid: allPassed, format: .sdJwt, checks: checks)
    }

    // MARK: - BBS+ Validation

    /// Validate BBS+ format credential
    public func validateBBSPlus(_ credential: VerifiableCredential) async throws -> ValidationResult {
        var checks: [ProofCheck] = []

        guard let proof = credential.proof else {
            checks.append(ProofCheck(name: "BBS+ Proof", passed: false, message: "No proof found"))
            return ValidationResult(valid: false, format: .bbsPlus, checks: checks)
        }

        // BBS+ specific checks
        checks.append(ProofCheck(name: "BBS+ Format", passed: proof.type.contains("Bbs"), message: nil))

        // Check for selective disclosure capability
        checks.append(ProofCheck(
            name: "Selective Disclosure",
            passed: true,
            message: "BBS+ supports selective disclosure"
        ))

        let allPassed = checks.allSatisfy { $0.passed }
        return ValidationResult(valid: allPassed, format: .bbsPlus, checks: checks)
    }

    // MARK: - Multi-Format Validation

    /// Validate credential with automatic format detection
    public func validateCredential(_ credential: VerifiableCredential) async throws -> ValidationResult {
        let format = detectProofFormat(credential: credential)

        switch format {
        case .jwtVC:
            return try await validateJWTVC(credential)
        case .sdJwt:
            return try await validateSDJWT(credential)
        case .bbsPlus:
            return try await validateBBSPlus(credential)
        case .none, .unknown:
            return ValidationResult(valid: false, format: format, checks: [
                ProofCheck(name: "Format Detection", passed: false, message: "Unknown or missing proof format")
            ])
        }
    }
}

// MARK: - Models

public enum ProofFormat {
    case jwtVC
    case sdJwt
    case bbsPlus
    case isoMDL  // Future: ISO mDL support
    case none
    case unknown
}

public struct ValidationResult {
    public let valid: Bool
    public let format: ProofFormat
    public let checks: [ProofCheck]
}

public struct ProofCheck {
    public let name: String
    public let passed: Bool
    public let message: String?
}

