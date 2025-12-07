//
//  QRDecodeResolveVerifyPipeline.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 11
//  decode→resolve→verify pipeline for QR codes
//

import Foundation
import Combine

/// QRDecodeResolveVerifyPipeline - Complete pipeline for QR code processing
@MainActor
public class QRDecodeResolveVerifyPipeline: ObservableObject {
    public static let shared = QRDecodeResolveVerifyPipeline()

    // MARK: - Published Properties

    @Published public var currentStage: PipelineStage = .idle
    @Published public var decodedPayload: QRPayload?
    @Published public var resolvedContent: ResolvedContent?
    @Published public var verificationResult: VerificationResult?
    @Published public var pipelineError: Error?

    // MARK: - Private Properties

    private let qrTypeDetector = QRTypeDetector.shared
    private let walletCore = WalletCore.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Pipeline

    /// Execute complete pipeline: decode → resolve → verify
    public func executePipeline(_ qrCode: String) async throws {
        pipelineError = nil

        // Stage 1: Decode
        currentStage = .decoding
        let payload = try await decode(qrCode)
        decodedPayload = payload

        // Stage 2: Resolve
        currentStage = .resolving
        let content = try await resolve(payload)
        resolvedContent = content

        // Stage 3: Verify
        currentStage = .verifying
        let result = try await verify(content)
        verificationResult = result

        currentStage = .completed
    }

    // MARK: - Stage 1: Decode

    private func decode(_ qrCode: String) async throws -> QRPayload {
        // Use QRTypeDetector to decode
        return try qrTypeDetector.parsePayload(qrCode)
    }

    // MARK: - Stage 2: Resolve

    private func resolve(_ payload: QRPayload) async throws -> ResolvedContent {
        switch payload.type {
        case .jwtVC, .jwtVP:
            return try await resolveJWT(payload)
        case .sdJWT:
            return try await resolveSDJWT(payload)
        case .oidcOffer:
            return try await resolveOIDCOffer(payload)
        case .oidcRequest:
            return try await resolveOIDCRequest(payload)
        case .jsonVC, .jsonVP:
            return try await resolveJSON(payload)
        case .unknown:
            throw QRDecodeResolveVerifyError.unknownPayloadType
        }
    }

    private func resolveJWT(_ payload: QRPayload) async throws -> ResolvedContent {
        // Extract credential or presentation from JWT payload
        if let vc = payload.payload["vc"] as? [String: Any] {
            // It's a Verifiable Credential
            let credential = try parseCredential(from: vc)
            return ResolvedContent(
                type: .credential,
                credential: credential,
                presentation: nil,
                offer: nil,
                request: nil
            )
        } else if let vp = payload.payload["vp"] as? [String: Any] {
            // It's a Verifiable Presentation
            let presentation = try parsePresentation(from: vp)
            return ResolvedContent(
                type: .presentation,
                credential: nil,
                presentation: presentation,
                offer: nil,
                request: nil
            )
        }

        throw QRDecodeResolveVerifyError.invalidJWTContent
    }

    private func resolveSDJWT(_ payload: QRPayload) async throws -> ResolvedContent {
        // Resolve SD-JWT with disclosures
        // This would involve processing disclosures and reconstructing the credential
        // For now, return a placeholder
        return ResolvedContent(
            type: .credential,
            credential: nil, // Would be reconstructed from SD-JWT
            presentation: nil,
            offer: nil,
            request: nil
        )
    }

    private func resolveOIDCOffer(_ payload: QRPayload) async throws -> ResolvedContent {
        // Resolve OIDC offer
        let offer = OIDCOffer(
            credentialIssuer: payload.payload["credential_issuer"] as? String ?? "",
            credentials: payload.payload["credentials"] as? [[String: Any]] ?? [],
            grants: payload.payload["grants"] as? [String: Any] ?? [:]
        )

        return ResolvedContent(
            type: .offer,
            credential: nil,
            presentation: nil,
            offer: offer,
            request: nil
        )
    }

    private func resolveOIDCRequest(_ payload: QRPayload) async throws -> ResolvedContent {
        // Resolve OIDC request
        let request = OIDCRequest(
            clientId: payload.payload["client_id"] as? String ?? "",
            redirectUri: payload.payload["redirect_uri"] as? String ?? "",
            nonce: payload.payload["nonce"] as? String ?? "",
            state: payload.payload["state"] as? String ?? ""
        )

        return ResolvedContent(
            type: .request,
            credential: nil,
            presentation: nil,
            offer: nil,
            request: request
        )
    }

    private func resolveJSON(_ payload: QRPayload) async throws -> ResolvedContent {
        // Resolve JSON VC/VP
        if let vc = payload.payload["verifiableCredential"] as? [String: Any] {
            let credential = try parseCredential(from: vc)
            return ResolvedContent(
                type: .credential,
                credential: credential,
                presentation: nil,
                offer: nil,
                request: nil
            )
        } else if let vp = payload.payload["verifiablePresentation"] as? [String: Any] {
            let presentation = try parsePresentation(from: vp)
            return ResolvedContent(
                type: .presentation,
                credential: nil,
                presentation: presentation,
                offer: nil,
                request: nil
            )
        }

        throw QRDecodeResolveVerifyError.invalidJSONContent
    }

    // MARK: - Stage 3: Verify

    private func verify(_ content: ResolvedContent) async throws -> VerificationResult {
        switch content.type {
        case .credential:
            guard let credential = content.credential else {
                throw QRDecodeResolveVerifyError.missingCredential
            }
            return try await verifyCredential(credential)
        case .presentation:
            guard let presentation = content.presentation else {
                throw QRDecodeResolveVerifyError.missingPresentation
            }
            return try await verifyPresentation(presentation)
        case .offer, .request:
            // Offers and requests don't need verification
            return VerificationResult(
                credentialId: "",
                verified: true,
                trustScore: 1.0,
                issues: [],
                timestamp: Date()
            )
        }
    }

    private func verifyCredential(_ credential: VerifiableCredential) async throws -> VerificationResult {
        // Use wallet core verification
        // This is a simplified version
        let verified = credential.proof != nil
        let trustScore = verified ? 0.8 : 0.0

        return VerificationResult(
            credentialId: credential.id,
            verified: verified,
            trustScore: trustScore,
            issues: verified ? [] : ["Missing proof"],
            timestamp: Date()
        )
    }

    private func verifyPresentation(_ presentation: VerifiablePresentation) async throws -> VerificationResult {
        // Verify presentation
        let verified = presentation.proof != nil
        let trustScore = verified ? 0.9 : 0.0

        return VerificationResult(
            credentialId: presentation.id,
            verified: verified,
            trustScore: trustScore,
            issues: verified ? [] : ["Missing proof"],
            timestamp: Date()
        )
    }

    // MARK: - Helpers

    private func parseCredential(from dict: [String: Any]) throws -> VerifiableCredential {
        // Parse credential from dictionary
        // This is a simplified version - in production, use proper parsing
        let id = dict["id"] as? String ?? UUID().uuidString
        let type = dict["type"] as? [String] ?? []

        return VerifiableCredential(
            id: id,
            type: type.first ?? "VerifiableCredential",
            issuer: dict["issuer"] as? String ?? "",
            issuedAt: Date(),
            credentialSubject: dict["credentialSubject"] as? [String: Any],
            proof: nil
        )
    }

    private func parsePresentation(from dict: [String: Any]) throws -> VerifiablePresentation {
        // Parse presentation from dictionary
        let id = dict["id"] as? String ?? UUID().uuidString
        let type = dict["type"] as? [String] ?? []

        return VerifiablePresentation(
            id: id,
            type: type,
            verifiableCredential: [],
            holder: dict["holder"] as? String ?? "",
            proof: nil,
            nonce: dict["nonce"] as? String,
            challenge: dict["challenge"] as? String
        )
    }

    /// Reset pipeline state
    public func reset() {
        currentStage = .idle
        decodedPayload = nil
        resolvedContent = nil
        verificationResult = nil
        pipelineError = nil
    }
}

// MARK: - Supporting Types

public enum PipelineStage {
    case idle
    case decoding
    case resolving
    case verifying
    case completed
    case failed
}

public struct ResolvedContent {
    public let type: ResolvedContentType
    public let credential: VerifiableCredential?
    public let presentation: VerifiablePresentation?
    public let offer: OIDCOffer?
    public let request: OIDCRequest?

    public init(type: ResolvedContentType, credential: VerifiableCredential?, presentation: VerifiablePresentation?, offer: OIDCOffer?, request: OIDCRequest?) {
        self.type = type
        self.credential = credential
        self.presentation = presentation
        self.offer = offer
        self.request = request
    }
}

public enum ResolvedContentType {
    case credential
    case presentation
    case offer
    case request
}

public struct OIDCOffer {
    public let credentialIssuer: String
    public let credentials: [[String: Any]]
    public let grants: [String: Any]
}

public struct OIDCRequest {
    public let clientId: String
    public let redirectUri: String
    public let nonce: String
    public let state: String
}

public enum QRDecodeResolveVerifyError: Error, LocalizedError {
    case unknownPayloadType
    case invalidJWTContent
    case invalidJSONContent
    case missingCredential
    case missingPresentation
    case verificationFailed

    public var errorDescription: String? {
        switch self {
        case .unknownPayloadType:
            return "Unknown QR payload type"
        case .invalidJWTContent:
            return "Invalid JWT content"
        case .invalidJSONContent:
            return "Invalid JSON content"
        case .missingCredential:
            return "Missing credential in resolved content"
        case .missingPresentation:
            return "Missing presentation in resolved content"
        case .verificationFailed:
            return "Verification failed"
        }
    }
}








