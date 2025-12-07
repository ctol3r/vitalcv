//
//  TrustEngine.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 1
//  TrustEngine for mixed proof formats (JWT-VC, SD-JWT, BBS+, ISO mDL)
//

import Foundation
import CryptoKit

/// TrustEngine - Unified engine for validating mixed proof formats
public class TrustEngine {
    public static let shared = TrustEngine()

    private let proofValidator = MultiProofValidator.shared
    private let jwtVerifier = MobileJWTVerifier.shared
    private let sdjwtEngine = SDJWTEngine.shared
    private let bbsEngine = BBSPlusEngine.shared

    private init() {}

    // MARK: - Mixed Proof Format Validation

    /// Validate credential with automatic format detection and mixed proof support
    public func validateMixedProof(
        _ credential: VerifiableCredential,
        options: ValidationOptions = ValidationOptions()
    ) async throws -> TrustValidationResult {
        // Detect all proof formats present
        let formats = detectAllProofFormats(credential)

        // Validate each format in parallel
        var results: [ProofFormatResult] = []

        for format in formats {
            let result = try await validateFormat(credential, format: format, options: options)
            results.append(result)
        }

        // Determine overall trust score
        let trustScore = calculateTrustScore(results)
        let isValid = trustScore >= options.minimumTrustScore

        return TrustValidationResult(
            valid: isValid,
            trustScore: trustScore,
            formats: formats,
            formatResults: results,
            timestamp: Date(),
            recommendations: generateRecommendations(results, trustScore: trustScore)
        )
    }

    // MARK: - Format Detection

    /// Detect all proof formats present in credential
    private func detectAllProofFormats(_ credential: VerifiableCredential) -> [ProofFormat] {
        var formats: [ProofFormat] = []

        // Check for JWT-VC
        if credential.proof?.type.contains("JWT") == true || credential.proof?.jws != nil {
            formats.append(.jwtVC)
        }

        // Check for SD-JWT
        if credential.credentialSubject.claims.keys.contains(where: { $0.hasPrefix("_sd") }) {
            formats.append(.sdJwt)
        }

        // Check for BBS+
        if credential.proof?.type.contains("Bbs") == true {
            formats.append(.bbsPlus)
        }

        // Check for ISO mDL (future)
        if credential.type.contains("mDL") || credential.type.contains("MobileDrivingLicense") {
            formats.append(.isoMDL)
        }

        return formats.isEmpty ? [.unknown] : formats
    }

    // MARK: - Format-Specific Validation

    private func validateFormat(
        _ credential: VerifiableCredential,
        format: ProofFormat,
        options: ValidationOptions
    ) async throws -> ProofFormatResult {
        switch format {
        case .jwtVC:
            let result = try await jwtVerifier.verify(credential: credential)
            return ProofFormatResult(
                format: .jwtVC,
                valid: result.valid,
                checks: result.checks,
                signatureValid: result.signatureValid,
                issuerVerified: result.issuerVerified
            )

        case .sdJwt:
            let result = try await sdjwtEngine.validate(credential)
            return ProofFormatResult(
                format: .sdJwt,
                valid: result.valid,
                checks: result.checks,
                signatureValid: result.signatureValid,
                issuerVerified: result.issuerVerified
            )

        case .bbsPlus:
            let result = try await bbsEngine.validate(credential)
            return ProofFormatResult(
                format: .bbsPlus,
                valid: result.valid,
                checks: result.checks,
                signatureValid: result.signatureValid,
                issuerVerified: result.issuerVerified
            )

        case .isoMDL:
            // Future: ISO mDL validation
            return ProofFormatResult(
                format: .isoMDL,
                valid: false,
                checks: [ProofCheck(name: "ISO mDL", passed: false, message: "Not yet implemented")],
                signatureValid: false,
                issuerVerified: false
            )

        default:
            return ProofFormatResult(
                format: format,
                valid: false,
                checks: [ProofCheck(name: "Format Detection", passed: false, message: "Unknown format")],
                signatureValid: false,
                issuerVerified: false
            )
        }
    }

    // MARK: - Trust Score Calculation

    private func calculateTrustScore(_ results: [ProofFormatResult]) -> Double {
        guard !results.isEmpty else { return 0.0 }

        var totalScore: Double = 0.0
        var weightSum: Double = 0.0

        for result in results {
            let weight = formatWeight(result.format)
            let formatScore = result.valid ? 1.0 : 0.0

            // Bonus for signature and issuer verification
            let signatureBonus = result.signatureValid ? 0.2 : 0.0
            let issuerBonus = result.issuerVerified ? 0.1 : 0.0

            let score = formatScore + signatureBonus + issuerBonus
            totalScore += score * weight
            weightSum += weight
        }

        return weightSum > 0 ? totalScore / weightSum : 0.0
    }

    private func formatWeight(_ format: ProofFormat) -> Double {
        switch format {
        case .jwtVC: return 1.0
        case .sdJwt: return 1.2  // Higher weight for selective disclosure
        case .bbsPlus: return 1.3  // Higher weight for zero-knowledge
        case .isoMDL: return 1.1
        default: return 0.5
        }
    }

    // MARK: - Recommendations

    private func generateRecommendations(
        _ results: [ProofFormatResult],
        trustScore: Double
    ) -> [TrustRecommendation] {
        var recommendations: [TrustRecommendation] = []

        if trustScore < 0.7 {
            recommendations.append(.lowTrustScore)
        }

        let invalidFormats = results.filter { !$0.valid }
        if !invalidFormats.isEmpty {
            recommendations.append(.invalidProofFormats(invalidFormats.map { $0.format }))
        }

        let unverifiedSignatures = results.filter { !$0.signatureValid }
        if !unverifiedSignatures.isEmpty {
            recommendations.append(.signatureVerificationFailed)
        }

        let unverifiedIssuers = results.filter { !$0.issuerVerified }
        if !unverifiedIssuers.isEmpty {
            recommendations.append(.issuerNotVerified)
        }

        return recommendations
    }
}

// MARK: - Models

public struct ValidationOptions {
    public let minimumTrustScore: Double
    public let requireSignatureVerification: Bool
    public let requireIssuerVerification: Bool
    public let allowMixedFormats: Bool

    public init(
        minimumTrustScore: Double = 0.7,
        requireSignatureVerification: Bool = true,
        requireIssuerVerification: Bool = true,
        allowMixedFormats: Bool = true
    ) {
        self.minimumTrustScore = minimumTrustScore
        self.requireSignatureVerification = requireSignatureVerification
        self.requireIssuerVerification = requireIssuerVerification
        self.allowMixedFormats = allowMixedFormats
    }
}

public struct TrustValidationResult {
    public let valid: Bool
    public let trustScore: Double
    public let formats: [ProofFormat]
    public let formatResults: [ProofFormatResult]
    public let timestamp: Date
    public let recommendations: [TrustRecommendation]
}

public struct ProofFormatResult {
    public let format: ProofFormat
    public let valid: Bool
    public let checks: [ProofCheck]
    public let signatureValid: Bool
    public let issuerVerified: Bool
}

public enum TrustRecommendation {
    case lowTrustScore
    case invalidProofFormats([ProofFormat])
    case signatureVerificationFailed
    case issuerNotVerified
    case credentialExpiringSoon
    case chainAnchorMissing
}

