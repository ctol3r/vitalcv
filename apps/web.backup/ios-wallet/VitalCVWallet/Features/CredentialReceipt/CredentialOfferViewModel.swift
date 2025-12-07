//
//  CredentialOfferViewModel.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 1-2
//  ObservableObject @MainActor ViewModel for credential offer intake
//

import Foundation
import SwiftUI

/// State for credential offer processing (Phase 1 - Task 2)
enum CredentialOfferState: Equatable {
    case idle
    case loading
    case preview(EnhancedCredentialOffer)
    case error(CredentialOfferError)

    var isLoading: Bool {
        if case .loading = self {
            return true
        }
        return false
    }

    var offer: EnhancedCredentialOffer? {
        if case .preview(let offer) = self {
            return offer
        }
        return nil
    }

    var error: CredentialOfferError? {
        if case .error(let error) = self {
            return error
        }
        return nil
    }
}

/// Enhanced CredentialOffer model with metadata (Phase 1 - Task 3)
/// Compatible with OIDC4VCI format from OIDC4VCIService
struct EnhancedCredentialOffer: Codable, Equatable, Identifiable {
    let id: String
    let type: String // e.g., "MedicalLicense", "BoardCertification"
    let issuer: String // Issuer identifier/URL
    let issuerName: String?
    let issuerLogo: String?
    let metadataURL: URL // URL to fetch full metadata
    let formats: [CredentialFormat] // Supported formats (vc+sd-jwt, vc+jwt, etc.)
    let credentialTypes: [String] // VC types
    let authorizationServer: URL?
    let credentialEndpoint: URL?
    let expiresAt: Date?
    let issuedAt: Date?

    // OIDC4VCI specific fields
    let credentialOfferURI: String?
    let grants: Grant?

    // Convert to basic OIDC4VCI CredentialOffer format
    func toOIDC4VCICredentialOffer() -> CredentialOffer {
        let credentialDefinitions = formats.map { format in
            CredentialDefinition(
                format: format.format,
                types: credentialTypes,
                trustFramework: nil
            )
        }

        return CredentialOffer(
            credentialIssuer: issuer,
            credentials: credentialDefinitions,
            grants: grants,
            authorizationServer: authorizationServer
        )
    }

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case issuer
        case issuerName
        case issuerLogo
        case metadataURL
        case formats
        case credentialTypes
        case authorizationServer
        case credentialEndpoint
        case expiresAt
        case issuedAt
        case credentialOfferURI
        case grants
    }
}

struct CredentialFormat: Codable, Equatable {
    let format: String // "vc+sd-jwt", "vc+jwt", "vc+ldp", "mDL"
    let cryptographicBindingMethods: [String]?
    let credentialSigningAlgValuesSupported: [String]?
}

/// Credential offer metadata from issuer
struct CredentialOfferMetadata: Codable {
    let credentialIssuer: String
    let authorizationServer: URL?
    let tokenEndpoint: URL?
    let credentialEndpoint: URL?
    let pushedAuthorizationRequestEndpoint: URL?
    let supportedCredentialFormats: [String]?
    let supportedCredentialTypes: [String]?
    let display: [IssuerDisplay]?
    let credentialConfigurationsSupported: [String: CredentialConfiguration]?
}

struct IssuerDisplay: Codable {
    let name: String?
    let locale: String?
    let logo: Logo?
    let description: String?
    let backgroundColor: String?
    let textColor: String?
}

struct Logo: Codable {
    let url: String?
    let altText: String?
}

struct CredentialConfiguration: Codable {
    let format: String?
    let scope: String?
    let cryptographicBindingMethodsSupported: [String]?
    let credentialSigningAlgValuesSupported: [String]?
    let display: [IssuerDisplay]?
}

/// Validation result for credential offers
struct OfferValidationResult {
    let isValid: Bool
    let errors: [CredentialOfferError]
    let warnings: [String]
}

/// Security check result
struct OfferSecurityCheck {
    let isSafe: Bool
    let issuerDomain: String?
    let redirectDomain: String?
    let trustTier: TrustTier?
    let issues: [String]
}

enum TrustTier: String, Codable {
    case trusted = "trusted" // Verified issuer in registry
    case verified = "verified" // Domain verified
    case unknown = "unknown" // Not in registry
    case untrusted = "untrusted" // Known bad actor
}

/// Credential offer errors
enum CredentialOfferError: Error, Equatable, LocalizedError {
    case invalidURL
    case invalidOfferFormat
    case expiredOffer
    case invalidIssuer
    case untrustedIssuer
    case unsupportedFormat
    case invalidSchema
    case networkError(String)
    case metadataFetchFailed(String)
    case securityCheckFailed(String)
    case invalidRedirectURI
    case missingRequiredField(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid credential offer URL"
        case .invalidOfferFormat:
            return "Credential offer format is invalid"
        case .expiredOffer:
            return "This credential offer has expired"
        case .invalidIssuer:
            return "Invalid issuer identifier"
        case .untrustedIssuer:
            return "Issuer is not trusted"
        case .unsupportedFormat:
            return "Credential format is not supported"
        case .invalidSchema:
            return "Credential schema is invalid"
        case .networkError(let message):
            return "Network error: \(message)"
        case .metadataFetchFailed(let message):
            return "Failed to fetch metadata: \(message)"
        case .securityCheckFailed(let message):
            return "Security check failed: \(message)"
        case .invalidRedirectURI:
            return "Invalid redirect URI"
        case .missingRequiredField(let field):
            return "Missing required field: \(field)"
        }
    }
}

/// Main ViewModel for credential offer intake
@MainActor
class CredentialOfferIntakeViewModel: ObservableObject {
    @Published var state: CredentialOfferState = .idle
    @Published var metadata: CredentialOfferMetadata?
    @Published var validationResult: OfferValidationResult?
    @Published var securityCheck: OfferSecurityCheck?

    private let oidcService = OIDC4VCIService.shared
    private let securityChecker = OfferSecurityChecker.shared

    // MARK: - Public Methods

    /// Process a credential offer from a deep link
    func processOffer(from url: URL) async {
        state = .loading

        do {
            // Extract credential offer from URL
            let offer = try await extractOfferFromURL(url)

            // Fetch metadata
            let metadata = try await fetchMetadata(url: offer.metadataURL)
            self.metadata = metadata

            // Validate offer
            let validation = try validateOffer(offer, metadata: metadata)
            self.validationResult = validation

            if !validation.isValid {
                state = .error(validation.errors.first ?? .invalidOfferFormat)
                return
            }

            // Security check
            let security = await securityChecker.checkOffer(offer, metadata: metadata)
            self.securityCheck = security

            if !security.isSafe {
                state = .error(.securityCheckFailed(security.issues.joined(separator: ", ")))
                return
            }

            // All checks passed - show preview
            state = .preview(offer)

        } catch {
            let offerError = error as? CredentialOfferError ?? .networkError(error.localizedDescription)
            state = .error(offerError)
        }
    }

    /// Process a credential offer URI directly
    func processOffer(uri: String) async {
        guard let url = URL(string: uri) else {
            state = .error(.invalidURL)
            return
        }

        await processOffer(from: url)
    }

    /// Reset state
    func reset() {
        state = .idle
        metadata = nil
        validationResult = nil
        securityCheck = nil
    }

    // MARK: - Private Methods

    private func extractOfferFromURL(_ url: URL) async throws -> EnhancedCredentialOffer {
        guard url.scheme == "vitalcv" || url.scheme == "openid-credential-offer" else {
            throw CredentialOfferError.invalidURL
        }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw CredentialOfferError.invalidURL
        }

        // Extract credential_offer parameter
        guard let credentialOfferParam = components.queryItems?.first(where: { $0.name == "credential_offer" })?.value else {
            throw CredentialOfferError.missingRequiredField("credential_offer")
        }

        // If it's a URL, fetch it; otherwise parse as JSON
        if let offerURL = URL(string: credentialOfferParam) {
            return try await fetchOfferFromURL(offerURL)
        } else {
            // Try to parse as inline JSON
            guard let data = credentialOfferParam.data(using: .utf8) else {
                throw CredentialOfferError.invalidOfferFormat
            }
            return try parseOfferFromData(data)
        }
    }

    private func fetchOfferFromURL(_ url: URL) async throws -> EnhancedCredentialOffer {
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CredentialOfferError.networkError("Failed to fetch offer")
        }

        return try parseOfferFromData(data)
    }

    private func parseOfferFromData(_ data: Data) throws -> EnhancedCredentialOffer {
        // Try to parse as OIDC4VCI credential offer format
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        // First, try standard OIDC4VCI format
        if let oidcOffer = try? decoder.decode(OIDC4VCICredentialOffer.self, from: data) {
            return try convertOIDC4VCIToCredentialOffer(oidcOffer)
        }

        // Fallback: try direct EnhancedCredentialOffer format
        return try decoder.decode(EnhancedCredentialOffer.self, from: data)
    }

    private func convertOIDC4VCIToCredentialOffer(_ oidcOffer: OIDC4VCICredentialOffer) throws -> EnhancedCredentialOffer {
        guard let credentialIssuer = oidcOffer.credentialIssuer,
              let metadataURL = URL(string: credentialIssuer)?.appendingPathComponent(".well-known/openid_credential_issuer") else {
            throw CredentialOfferError.invalidIssuer
        }

        let formats = oidcOffer.credentials?.compactMap { def -> CredentialFormat? in
            guard let format = def.format else { return nil }
            return CredentialFormat(
                format: format,
                cryptographicBindingMethods: nil,
                credentialSigningAlgValuesSupported: nil
            )
        } ?? []

        let credentialTypes = oidcOffer.credentials?.flatMap { $0.types ?? [] } ?? []

        return EnhancedCredentialOffer(
            id: UUID().uuidString,
            type: credentialTypes.first ?? "VerifiableCredential",
            issuer: credentialIssuer,
            issuerName: nil,
            issuerLogo: nil,
            metadataURL: metadataURL,
            formats: formats,
            credentialTypes: credentialTypes,
            authorizationServer: nil, // Will be populated from metadata
            credentialEndpoint: nil, // Will be populated from metadata
            expiresAt: nil,
            issuedAt: Date(),
            credentialOfferURI: nil,
            grants: oidcOffer.grants
        )
    }

    /// Fetch metadata from issuer
    func fetchMetadata(url: URL) async throws -> CredentialOfferMetadata {
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CredentialOfferError.metadataFetchFailed("HTTP \(response as? HTTPURLResponse)?.statusCode ?? 0)")
        }

        let decoder = JSONDecoder()
        return try decoder.decode(CredentialOfferMetadata.self, from: data)
    }

    /// Validate offer against rules (Phase 1 - Task 6)
    private func validateOffer(_ offer: EnhancedCredentialOffer, metadata: CredentialOfferMetadata) throws -> OfferValidationResult {
        var errors: [CredentialOfferError] = []
        var warnings: [String] = []

        // Check expiration
        if let expiresAt = offer.expiresAt, expiresAt < Date() {
            errors.append(.expiredOffer)
        }

        // Check issuer
        if offer.issuer.isEmpty {
            errors.append(.invalidIssuer)
        }

        // Check supported formats
        let supportedFormats = metadata.supportedCredentialFormats ?? []
        let offerFormats = offer.formats.map { $0.format }
        let hasSupportedFormat = offerFormats.contains { supportedFormats.contains($0) }

        if !hasSupportedFormat && !offerFormats.isEmpty {
            errors.append(.unsupportedFormat)
        }

        // Check credential types
        let supportedTypes = metadata.supportedCredentialTypes ?? []
        let hasSupportedType = offer.credentialTypes.contains { type in
            supportedTypes.contains { supportedType in
                supportedType.contains(type) || type.contains(supportedType)
            }
        }

        if !hasSupportedType && !offer.credentialTypes.isEmpty {
            warnings.append("Some credential types may not be supported by issuer")
        }

        // Check required endpoints
        if metadata.credentialEndpoint == nil {
            errors.append(.missingRequiredField("credential_endpoint"))
        }

        return OfferValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings
        )
    }
}

// MARK: - OIDC4VCI Format Support

private struct OIDC4VCICredentialOffer: Codable {
    let credentialIssuer: String?
    let credentials: [CredentialDefinition]?
    let grants: Grant?
    let authorizationServer: URL?
}

