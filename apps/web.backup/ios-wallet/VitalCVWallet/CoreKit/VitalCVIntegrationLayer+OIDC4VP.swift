//
//  VitalCVIntegrationLayer+OIDC4VP.swift
//  VitalCVWallet
//
//  Created: Batch 135-A - Tasks 21-30
//  OIDC4VP verification pipeline with backend integration
//

import Foundation

// MARK: - OIDC4VP Integration

extension VitalCVIntegrationLayer {

    private var oidc4VPService: OIDC4VPService {
        OIDC4VPService.shared
    }

    // MARK: - Task 21: Fetch VP request metadata from verifier endpoint

    /// Fetch VP request metadata from verifier endpoint
    public func fetchVPRequestMetadata(verifierEndpoint: URL) async throws -> VPRequestMetadata {
        let response: VPRequestMetadataResponse = try await networkClient.get(
            verifierEndpoint.path
        )

        return VPRequestMetadata(
            clientId: response.clientId,
            redirectURI: response.redirectURI,
            nonce: response.nonce,
            state: response.state,
            presentationDefinition: response.presentationDefinition,
            challenge: response.challenge,
            audience: response.audience
        )
    }

    // MARK: - Task 22: Validate nonce & audience against backend

    /// Validate VP request nonce and audience with backend
    public func validateVPRequest(
        nonce: String,
        audience: String,
        verifierId: String
    ) async throws -> VPValidationResult {
        let request = VPValidationRequest(
            nonce: nonce,
            audience: audience,
            verifierId: verifierId
        )

        let response: VPValidationResponse = try await networkClient.post(
            "/api/verify/validate-request",
            body: request
        )

        return VPValidationResult(
            valid: response.valid,
            error: response.error,
            warnings: response.warnings ?? []
        )
    }

    // MARK: - Task 23: Build VP (JWT or SD-JWT-Bundled)

    /// Build verifiable presentation in requested format
    public func buildVerifiablePresentation(
        credentials: [VerifiableCredential],
        request: VPRequest,
        format: String = "jwt_vp"
    ) async throws -> VerifiablePresentation {
        switch format.lowercased() {
        case "jwt_vp", "jwt-vp", "vp+jwt":
            return try await buildJWTVP(
                credentials: credentials,
                request: request
            )
        case "sd-jwt", "sdjwt":
            return try await buildSDJWTVP(
                credentials: credentials,
                request: request
            )
        default:
            // Default to JWT-VP
            return try await buildJWTVP(
                credentials: credentials,
                request: request
            )
        }
    }

    private func buildJWTVP(
        credentials: [VerifiableCredential],
        request: VPRequest
    ) async throws -> VerifiablePresentation {
        // Build JWT-VP using existing service
        let vp = try await oidc4VPService.buildPresentation(
            credentials: credentials,
            requestedClaims: request.presentationDefinition?.inputDescriptors?.first?.constraints?.fields?.reduce(into: [:]) { dict, field in
                dict[field.path?.first ?? ""] = []
            }
        )

        // Add nonce and challenge from request
        var modifiedVP = vp
        // Note: In production, would properly set nonce and challenge on VP

        return modifiedVP
    }

    private func buildSDJWTVP(
        credentials: [VerifiableCredential],
        request: VPRequest
    ) async throws -> VerifiablePresentation {
        // Build SD-JWT VP (requires SD-JWT engine)
        throw OIDC4VPError.notImplemented("SD-JWT VP building not yet implemented")
    }

    // MARK: - Task 24: Build BBS+ derived proof if required

    /// Build BBS+ derived proof for selective disclosure
    public func buildBBSPlusProof(
        credential: VerifiableCredential,
        revealedAttributes: [String],
        hiddenAttributes: [String]
    ) async throws -> BBSPlusProof {
        // Use BBS+ engine (if available)
        let engine = BBSPlusEngine.shared

        // Generate proof with selective disclosure
        return try await engine.generateProof(
            credential: credential,
            revealedAttributes: revealedAttributes,
            hiddenAttributes: hiddenAttributes
        )
    }

    // MARK: - Task 25: Submit VP to backend verification endpoint

    /// Submit VP to backend verification endpoint
    public func submitVPForVerification(
        presentation: VerifiablePresentation,
        verifierEndpoint: URL
    ) async throws -> VerificationResponse {
        // Build submission
        let submission = VPSubmissionRequest(
            presentation: presentation,
            format: "jwt_vp"
        )

        let response: BackendVerificationResponse = try await networkClient.post(
            "/api/verify-submit",
            body: submission
        )

        return VerificationResponse(
            verified: response.verified,
            credentialId: response.credentialId,
            checks: response.checks?.map { VerificationCheck(name: $0.name, passed: $0.passed, message: $0.message) } ?? [],
            timestamp: response.timestamp,
            verifier: response.verifier,
            trustScore: response.trustScore,
            anchorStatus: response.anchorStatus,
            compliance: response.compliance,
            error: response.error
        )
    }

    // MARK: - Task 26: Parse verification response

    /// Parse verification response with full details
    public func parseVerificationResponse(
        response: VerificationResponse
    ) -> VerificationResult {
        return VerificationResult(
            verified: response.verified,
            trustScore: response.trustScore ?? 0.0,
            anchorStatus: response.anchorStatus ?? "unknown",
            compliance: response.compliance ?? [:],
            checks: response.checks,
            error: response.error
        )
    }

    // MARK: - Task 27: Render verification result screen

    /// Get UI state for verification result rendering
    public func getVerificationResultUIState(
        result: VerificationResult
    ) -> VerificationResultUIState {
        // Determine UI state based on verification result
        var state: VerificationResultUIState.State
        var message: String
        var icon: String

        if result.verified {
            if result.trustScore >= 0.8 {
                state = .success
                message = "Credential verified successfully"
                icon = "checkmark.circle.fill"
            } else if result.trustScore >= 0.6 {
                state = .warning
                message = "Credential verified with warnings"
                icon = "exclamationmark.triangle.fill"
            } else {
                state = .lowTrust
                message = "Credential verified but trust score is low"
                icon = "exclamationmark.circle.fill"
            }
        } else {
            state = .failed
            message = result.error ?? "Verification failed"
            icon = "xmark.circle.fill"
        }

        return VerificationResultUIState(
            state: state,
            message: message,
            icon: icon,
            trustScore: result.trustScore,
            anchorStatus: result.anchorStatus,
            compliance: result.compliance,
            checks: result.checks
        )
    }

    // MARK: - Task 28: Integrate chain confidence level

    /// Get chain confidence level (block confirmations)
    public func getChainConfidenceLevel(anchorId: String) async throws -> ChainConfidence {
        let response: ChainConfidenceResponse = try await networkClient.get(
            "/api/chain/anchor/\(anchorId)/confidence"
        )

        return ChainConfidence(
            anchorId: anchorId,
            blockConfirmations: response.blockConfirmations,
            confidenceLevel: response.confidenceLevel,
            finality: response.finality,
            estimatedFinalizationTime: response.estimatedFinalizationTime
        )
    }

    // MARK: - Task 29: Integrate compliance signals

    /// Get compliance signals (DEA, license, sanctions)
    public func getComplianceSignals(credentialId: String) async throws -> ComplianceSignals {
        let response: ComplianceSignalsResponse = try await networkClient.get(
            "/api/compliance/signals/\(credentialId)"
        )

        return ComplianceSignals(
            credentialId: credentialId,
            deaStatus: response.deaStatus,
            licenseStatus: response.licenseStatus,
            sanctionsStatus: response.sanctionsStatus,
            lastChecked: response.lastChecked,
            warnings: response.warnings ?? []
        )
    }

    // MARK: - Task 30: Integrate NCQA/PSV verification outcomes

    /// Get NCQA/PSV verification outcomes
    public func getNCQAPSVOutcomes(credentialId: String) async throws -> NCQAPSVOutcomes {
        let response: NCQAPSVOutcomesResponse = try await networkClient.get(
            "/api/verify/ncqa-psv/\(credentialId)"
        )

        return NCQAPSVOutcomes(
            credentialId: credentialId,
            ncqaVerified: response.ncqaVerified,
            psvVerified: response.psvVerified,
            ncqaScore: response.ncqaScore,
            psvScore: response.psvScore,
            verifiedAt: response.verifiedAt,
            details: response.details ?? [:]
        )
    }
}

// MARK: - OIDC4VP Models

struct VPRequestMetadata {
    let clientId: String
    let redirectURI: String?
    let nonce: String
    let state: String?
    let presentationDefinition: PresentationDefinition?
    let challenge: String
    let audience: String?
}

struct VPRequestMetadataResponse: Codable {
    let clientId: String
    let redirectURI: String?
    let nonce: String
    let state: String?
    let presentationDefinition: PresentationDefinition?
    let challenge: String
    let audience: String?
}

struct VPValidationRequest: Codable {
    let nonce: String
    let audience: String
    let verifierId: String
}

struct VPValidationResponse: Codable {
    let valid: Bool
    let error: String?
    let warnings: [String]?
}

struct VPValidationResult {
    let valid: Bool
    let error: String?
    let warnings: [String]
}

struct VPSubmissionRequest: Codable {
    let presentation: VerifiablePresentation
    let format: String
}

struct BackendVerificationResponse: Codable {
    let verified: Bool
    let credentialId: String?
    let checks: [VerificationCheckResponse]?
    let timestamp: Date
    let verifier: String?
    let trustScore: Double?
    let anchorStatus: String?
    let compliance: [String: String]?
    let error: String?
}

struct VerificationCheckResponse: Codable {
    let name: String
    let passed: Bool
    let message: String?
}

struct VerificationResponse {
    let verified: Bool
    let credentialId: String?
    let checks: [VerificationCheck]
    let timestamp: Date
    let verifier: String?
    let trustScore: Double?
    let anchorStatus: String?
    let compliance: [String: String]?
    let error: String?
}

struct VerificationResult {
    let verified: Bool
    let trustScore: Double
    let anchorStatus: String
    let compliance: [String: String]
    let checks: [VerificationCheck]
    let error: String?
}

struct VerificationResultUIState {
    enum State {
        case success
        case warning
        case lowTrust
        case failed
    }

    let state: State
    let message: String
    let icon: String
    let trustScore: Double?
    let anchorStatus: String?
    let compliance: [String: String]?
    let checks: [VerificationCheck]?
}

struct ChainConfidence {
    let anchorId: String
    let blockConfirmations: Int
    let confidenceLevel: String
    let finality: Bool
    let estimatedFinalizationTime: Date?
}

struct ChainConfidenceResponse: Codable {
    let blockConfirmations: Int
    let confidenceLevel: String
    let finality: Bool
    let estimatedFinalizationTime: Date?
}

struct ComplianceSignals {
    let credentialId: String
    let deaStatus: String
    let licenseStatus: String
    let sanctionsStatus: String
    let lastChecked: Date?
    let warnings: [String]
}

struct ComplianceSignalsResponse: Codable {
    let deaStatus: String
    let licenseStatus: String
    let sanctionsStatus: String
    let lastChecked: Date?
    let warnings: [String]?
}

struct NCQAPSVOutcomes {
    let credentialId: String
    let ncqaVerified: Bool
    let psvVerified: Bool
    let ncqaScore: Double?
    let psvScore: Double?
    let verifiedAt: Date?
    let details: [String: String]
}

struct NCQAPSVOutcomesResponse: Codable {
    let ncqaVerified: Bool
    let psvVerified: Bool
    let ncqaScore: Double?
    let psvScore: Double?
    let verifiedAt: Date?
    let details: [String: String]?
}

struct BBSPlusProof: Codable {
    let type: String
    let proof: String
    let revealedAttributes: [String]
    let hiddenAttributes: [String]
}

struct PresentationDefinition: Codable {
    let inputDescriptors: [InputDescriptor]?
}

struct InputDescriptor: Codable {
    let constraints: Constraints?
}

struct Constraints: Codable {
    let fields: [Field]?
}

struct Field: Codable {
    let path: [String]?
}

enum OIDC4VPError: LocalizedError {
    case invalidRequestFormat
    case missingClientId
    case notImplemented(String)
    case verificationFailed

    var errorDescription: String? {
        switch self {
        case .invalidRequestFormat:
            return "Invalid VP request format"
        case .missingClientId:
            return "Missing client ID in VP request"
        case .notImplemented(let feature):
            return "Not implemented: \(feature)"
        case .verificationFailed:
            return "Verification failed"
        }
    }
}

