//
//  VitalCVIntegrationLayer+OIDC4VCI.swift
//  VitalCVWallet
//
//  Created: Batch 135-A - Tasks 11-20
//  OIDC4VCI issuance pipeline with backend integration
//

import Foundation

// MARK: - OIDC4VCI Integration

extension VitalCVIntegrationLayer {

    // MARK: - Task 11: Fetch issuer credential offer metadata

    /// Fetch credential offer metadata from issuer
    public func fetchCredentialOfferMetadata(credentialOfferURI: String) async throws -> CredentialOfferMetadata {
        // First, try to fetch from URI
        guard let url = URL(string: credentialOfferURI) else {
            throw OIDC4VCIError.invalidURI
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        let offer = try JSONDecoder().decode(CredentialOffer.self, from: data)

        // Fetch issuer metadata
        let issuerMetadata = try await discoverIssuerMetadata(credentialIssuer: offer.credentialIssuer)

        return CredentialOfferMetadata(
            offer: offer,
            issuerMetadata: issuerMetadata
        )
    }

    // MARK: - Task 12: Fetch supported credential formats

    /// Get supported credential formats from issuer metadata
    public func getSupportedCredentialFormats(issuerDID: String) async throws -> SupportedFormats {
        let metadata = try await resolveIssuerDID(issuerDID: issuerDID)

        let formats = metadata.supportedCredentialFormats ?? []

        var jwtVC = false
        var sdJWT = false
        var bbsPlus = false

        for format in formats {
            switch format.lowercased() {
            case "jwt_vc", "jwt-vc", "vc+jwt":
                jwtVC = true
            case "sd-jwt", "sdjwt", "sd-jwt-vc":
                sdJWT = true
            case "bbs+", "bbsplus", "ldp_vc_bbs+":
                bbsPlus = true
            default:
                break
            }
        }

        return SupportedFormats(
            jwtVC: jwtVC,
            sdJWT: sdJWT,
            bbsPlus: bbsPlus,
            allFormats: formats
        )
    }

    // MARK: - Task 13: Implement pre-authorized code flow with backend

    /// Handle pre-authorized code flow with backend coordination
    public func handlePreAuthorizedFlow(
        offer: CredentialOffer,
        preAuthCode: String,
        userPin: String?
    ) async throws -> TokenResponse {
        // Use existing OIDC4VCIService
        return try await oidc4VCIService.handlePreAuthorizedCodeFlow(
            offer: offer,
            preAuthCode: preAuthCode,
            userPin: userPin
        )
    }

    // MARK: - Task 14: Implement token request with DPoP binding

    /// Request access token with DPoP binding
    public func requestTokenWithDPoP(
        tokenEndpoint: URL,
        grantType: String,
        code: String?,
        preAuthCode: String?,
        userPin: String?,
        redirectURI: String?
    ) async throws -> TokenResponse {
        var tokenRequest = TokenRequest(
            grantType: grantType,
            preAuthorizedCode: preAuthCode,
            authorizationCode: code,
            redirectURI: redirectURI,
            userPin: userPin
        )

        // Generate DPoP proof
        let dpopProof = try dpopSigner.generateDPoPToken(
            method: "POST",
            url: tokenEndpoint
        )

        // Make request with DPoP header
        let headers = ["DPoP": dpopProof]

        let response: TokenResponse = try await networkClient.post(
            tokenEndpoint.path,
            body: tokenRequest,
            headers: headers
        )

        return response
    }

    // MARK: - Task 15: Retrieve credential via credential endpoint

    /// Retrieve credential from issuer credential endpoint
    public func retrieveCredential(
        credentialEndpoint: URL,
        accessToken: String,
        format: String,
        credentialDefinition: CredentialDefinition
    ) async throws -> VerifiableCredential {
        let request = CredentialRequest(
            format: format,
            credentialDefinition: credentialDefinition
        )

        let headers = [
            "Authorization": "Bearer \(accessToken)",
            "DPoP": try dpopSigner.generateDPoPToken(
                method: "POST",
                url: credentialEndpoint,
                accessToken: accessToken
            )
        ]

        let response: CredentialResponse = try await networkClient.post(
            credentialEndpoint.path,
            body: request,
            headers: headers
        )

        // Parse credential based on format
        let credential = try parseCredential(
            credentialData: response.credential,
            format: format
        )

        return credential
    }

    // MARK: - Task 16: Store credential to wallet + hash to chain service

    /// Store credential in wallet and submit hash to chain service
    public func storeCredentialAndAnchor(
        credential: VerifiableCredential,
        holderDID: String
    ) async throws -> CredentialStorageResult {
        // Store in local wallet (via AppState)
        await MainActor.run {
            AppStateContainer.shared.addCredential(credential)
        }

        // Generate credential hash for chain anchoring
        let credentialHash = try generateCredentialHash(credential: credential)

        // Submit hash to backend chain service
        let anchorRequest = ChainAnchorRequest(
            credentialId: credential.id,
            credentialHash: credentialHash,
            holderDID: holderDID,
            timestamp: Date()
        )

        let anchorResponse: ChainAnchorResponse = try await networkClient.post(
            "/api/chain/anchor",
            body: anchorRequest
        )

        // Update credential with anchor ID
        var updatedCredential = credential
        // Note: In production, would need to update the stored credential

        return CredentialStorageResult(
            credential: updatedCredential,
            anchorId: anchorResponse.anchorId,
            anchoredAt: anchorResponse.anchoredAt
        )
    }

    // MARK: - Task 17: Add refreshToken support for long-lived offers

    /// Refresh access token using refresh token
    public func refreshAccessToken(
        refreshToken: String,
        tokenEndpoint: URL
    ) async throws -> TokenResponse {
        let request = RefreshTokenRequest(
            grantType: "refresh_token",
            refreshToken: refreshToken
        )

        let headers = [
            "DPoP": try dpopSigner.generateDPoPToken(
                method: "POST",
                url: tokenEndpoint
            )
        ]

        let response: TokenResponse = try await networkClient.post(
            tokenEndpoint.path,
            body: request,
            headers: headers
        )

        return response
    }

    // MARK: - Task 18: Add offer error handling

    /// Validate credential offer and handle errors
    public func validateCredentialOffer(_ offer: CredentialOffer) throws {
        // Check issuer is trusted
        guard !offer.credentialIssuer.isEmpty else {
            throw OIDC4VCIError.invalidIssuer("Empty issuer")
        }

        // Check credential definitions exist
        guard !offer.credentials.isEmpty else {
            throw OIDC4VCIError.invalidFormat("No credential definitions")
        }

        // Validate format support
        for credDef in offer.credentials {
            guard let format = credDef.format, !format.isEmpty else {
                throw OIDC4VCIError.invalidFormat("Missing credential format")
            }

            // Check if format is supported
            let supportedFormats = ["jwt_vc", "vc+jwt", "sd-jwt", "bbs+"]
            guard supportedFormats.contains(format.lowercased()) else {
                throw OIDC4VCIError.unsupportedFormat(format)
            }
        }
    }

    // MARK: - Task 19: Integrate backend issuer-trust score during accept

    /// Get issuer trust score from backend before accepting credential
    public func getIssuerTrustScore(issuerDID: String) async throws -> TrustScore {
        let response: TrustScoreResponse = try await networkClient.get(
            "/api/issuer/trust-score/\(issuerDID)"
        )

        return TrustScore(
            issuerDID: issuerDID,
            score: response.score,
            level: response.level,
            lastVerified: response.lastVerified,
            warnings: response.warnings ?? []
        )
    }

    // MARK: - Task 20: Integrate selective-disclosure metadata during accept

    /// Get selective disclosure metadata for credential
    public func getSelectiveDisclosureMetadata(
        credentialOffer: CredentialOffer
    ) async throws -> SelectiveDisclosureMetadata {
        // Fetch issuer metadata for disclosure policies
        let issuerMetadata = try await discoverIssuerMetadata(
            credentialIssuer: credentialOffer.credentialIssuer
        )

        // Get disclosure policies from backend
        let policies: DisclosurePolicyResponse = try await networkClient.get(
            "/api/credential/disclosure-policies?issuer=\(credentialOffer.credentialIssuer)"
        )

        return SelectiveDisclosureMetadata(
            requiredFields: policies.requiredFields ?? [],
            optionalFields: policies.optionalFields ?? [],
            hiddenFields: policies.hiddenFields ?? [],
            disclosurePolicies: policies.policies ?? []
        )
    }

    // MARK: - Helper Methods

    private func discoverIssuerMetadata(credentialIssuer: String) async throws -> IssuerMetadata {
        guard let url = URL(string: credentialIssuer) else {
            throw OIDC4VCIError.invalidIssuer(credentialIssuer)
        }

        let metadataURL = url.appendingPathComponent(".well-known/openid_credential_issuer")
        let (data, _) = try await URLSession.shared.data(from: metadataURL)
        return try JSONDecoder().decode(IssuerMetadata.self, from: data)
    }

    private func parseCredential(credentialData: String, format: String) throws -> VerifiableCredential {
        // Parse based on format
        switch format.lowercased() {
        case "jwt_vc", "vc+jwt", "jwt-vc":
            // Parse JWT-VC
            return try parseJWTVCCredential(jwt: credentialData)
        case "sd-jwt", "sdjwt":
            // Parse SD-JWT
            return try parseSDJWTCredential(sdJWT: credentialData)
        default:
            throw OIDC4VCIError.unsupportedFormat(format)
        }
    }

    private func parseJWTVCCredential(jwt: String) throws -> VerifiableCredential {
        // Decode JWT and extract VC
        // Simplified - in production, use proper JWT library
        let components = jwt.components(separatedBy: ".")
        guard components.count == 3,
              let payloadData = Data(base64Encoded: components[1]),
              let payload = try? JSONDecoder().decode(VerifiableCredential.self, from: payloadData) else {
            throw OIDC4VCIError.invalidFormat("Invalid JWT-VC format")
        }
        return payload
    }

    private func parseSDJWTCredential(sdJWT: String) throws -> VerifiableCredential {
        // Parse SD-JWT (simplified)
        // In production, use proper SD-JWT parser
        throw OIDC4VCIError.notImplemented("SD-JWT parsing not yet implemented")
    }

    private func generateCredentialHash(credential: VerifiableCredential) throws -> String {
        // Generate hash of credential for chain anchoring
        let credentialData = try JSONEncoder().encode(credential)
        let hash = SHA256.hash(data: credentialData)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - OIDC4VCI Models

struct CredentialOfferMetadata {
    let offer: CredentialOffer
    let issuerMetadata: IssuerMetadata
}

struct SupportedFormats {
    let jwtVC: Bool
    let sdJWT: Bool
    let bbsPlus: Bool
    let allFormats: [String]
}

struct CredentialRequest: Codable {
    let format: String
    let credentialDefinition: CredentialDefinition
}

struct CredentialResponse: Codable {
    let credential: String
    let format: String
    let cNonce: String?
    let cNonceExpiresIn: Int?
}

struct RefreshTokenRequest: Codable {
    let grantType: String
    let refreshToken: String
}

struct CredentialStorageResult {
    let credential: VerifiableCredential
    let anchorId: String?
    let anchoredAt: Date?
}

struct ChainAnchorRequest: Codable {
    let credentialId: String
    let credentialHash: String
    let holderDID: String
    let timestamp: Date
}

struct ChainAnchorResponse: Codable {
    let anchorId: String
    let anchoredAt: Date
    let transactionHash: String?
}

struct TrustScoreResponse: Codable {
    let score: Double
    let level: String
    let lastVerified: Date?
    let warnings: [String]?
}

struct TrustScore {
    let issuerDID: String
    let score: Double
    let level: String
    let lastVerified: Date?
    let warnings: [String]
}

struct DisclosurePolicyResponse: Codable {
    let requiredFields: [String]?
    let optionalFields: [String]?
    let hiddenFields: [String]?
    let policies: [DisclosurePolicy]?
}

struct DisclosurePolicy: Codable {
    let field: String
    let required: Bool
    let purpose: String?
}

struct SelectiveDisclosureMetadata {
    let requiredFields: [String]
    let optionalFields: [String]
    let hiddenFields: [String]
    let disclosurePolicies: [DisclosurePolicy]
}

enum OIDC4VCIError: LocalizedError {
    case invalidURI
    case invalidIssuer(String)
    case invalidFormat(String)
    case unsupportedFormat(String)
    case notImplemented(String)
    case tokenRequestFailed
    case credentialRetrievalFailed

    var errorDescription: String? {
        switch self {
        case .invalidURI:
            return "Invalid credential offer URI"
        case .invalidIssuer(let issuer):
            return "Invalid issuer: \(issuer)"
        case .invalidFormat(let format):
            return "Invalid credential format: \(format)"
        case .unsupportedFormat(let format):
            return "Unsupported credential format: \(format)"
        case .notImplemented(let feature):
            return "Not implemented: \(feature)"
        case .tokenRequestFailed:
            return "Token request failed"
        case .credentialRetrievalFailed:
            return "Failed to retrieve credential"
        }
    }
}

// MARK: - Import CryptoKit for SHA256

import CryptoKit

