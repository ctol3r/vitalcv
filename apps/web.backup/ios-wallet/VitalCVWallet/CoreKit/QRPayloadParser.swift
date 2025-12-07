//
//  QRPayloadParser.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Payload Processing
//  Turn any QR code (VC, VP, SD-JWT, OIDC4VP) into a predictable data model
//

import Foundation
import CryptoKit

/// QRPayloadParser - Comprehensive payload parser with validation and security checks
public class QRPayloadParser {
    public static let shared = QRPayloadParser()

    private let trustedDomains: Set<String> = [
        "vitalcv.com",
        "api.vitalcv.com",
        "verify.vitalcv.com",
        "issuer.vitalcv.com"
    ]

    private let developmentMode: Bool

    public init(developmentMode: Bool = false) {
        self.developmentMode = developmentMode
    }

    // MARK: - Task 9: Detect Type

    /// Parse and detect QR code type
    public func parsePayload(_ qrCode: String) throws -> NormalizedQRPayload {
        // First, detect the type
        let type = QRTypeDetector.shared.detectType(qrCode)

        // Parse the raw payload
        let rawPayload = try QRTypeDetector.shared.parsePayload(qrCode)

        // Task 10: Validate required fields
        try validateRequiredFields(rawPayload)

        // Task 14: Security checks for spoofed URLs
        if !developmentMode {
            try validateSecurity(rawPayload)
        }

        // Normalize the payload
        return try normalizePayload(rawPayload)
    }

    // MARK: - Task 10: Validate Required Fields

    private func validateRequiredFields(_ payload: QRPayload) throws {
        switch payload.type {
        case .jwtVC, .jwtVP:
            try validateJWTFields(payload)
        case .sdJWT:
            try validateSDJWTFields(payload)
        case .oidcRequest:
            try validateOIDCRequestFields(payload)
        case .oidcOffer:
            try validateOIDCOfferFields(payload)
        case .jsonVC, .jsonVP:
            try validateJSONFields(payload)
        case .unknown:
            throw QRPayloadParserError.unknownPayloadType
        }
    }

    private func validateJWTFields(_ payload: QRPayload) throws {
        // Check for iss (issuer)
        guard payload.payload["iss"] != nil else {
            throw QRPayloadParserError.missingRequiredField("iss")
        }

        // Check for nbf (not before) or exp (expiration)
        if payload.payload["nbf"] == nil && payload.payload["exp"] == nil {
            throw QRPayloadParserError.missingRequiredField("nbf or exp")
        }

        // Check for cnf (confirmation) if it's a VP
        if payload.type == .jwtVP {
            guard payload.payload["cnf"] != nil else {
                throw QRPayloadParserError.missingRequiredField("cnf")
            }
        }
    }

    private func validateSDJWTFields(_ payload: QRPayload) throws {
        // SD-JWT requires disclosures
        guard let disclosures = payload.disclosures, !disclosures.isEmpty else {
            throw QRPayloadParserError.missingRequiredField("disclosures")
        }

        // Validate JWT part
        try validateJWTFields(payload)
    }

    private func validateOIDCRequestFields(_ payload: QRPayload) throws {
        // OIDC4VP request requires client_id, redirect_uri, nonce
        guard payload.payload["client_id"] != nil else {
            throw QRPayloadParserError.missingRequiredField("client_id")
        }

        guard payload.payload["redirect_uri"] != nil else {
            throw QRPayloadParserError.missingRequiredField("redirect_uri")
        }

        // Task 12: Validate nonce challenge
        guard let nonce = payload.payload["nonce"] as? String, !nonce.isEmpty else {
            throw QRPayloadParserError.missingRequiredField("nonce")
        }

        // Validate nonce format (should be a secure random string)
        if nonce.count < 16 {
            throw QRPayloadParserError.invalidNonce
        }
    }

    private func validateOIDCOfferFields(_ payload: QRPayload) throws {
        guard payload.payload["credential_issuer"] != nil else {
            throw QRPayloadParserError.missingRequiredField("credential_issuer")
        }
    }

    private func validateJSONFields(_ payload: QRPayload) throws {
        // JSON-LD credentials need @context and type
        guard payload.payload["@context"] != nil else {
            throw QRPayloadParserError.missingRequiredField("@context")
        }

        guard payload.payload["type"] != nil else {
            throw QRPayloadParserError.missingRequiredField("type")
        }
    }

    // MARK: - Task 14: Security Checks

    private func validateSecurity(_ payload: QRPayload) throws {
        // Check for URLs in the payload
        if let urlString = extractURL(from: payload) {
            guard let url = URL(string: urlString),
                  let host = url.host else {
                throw QRPayloadParserError.suspiciousURL
            }

            // Check if domain is trusted
            let isTrusted = trustedDomains.contains(host) ||
                           trustedDomains.contains { host.hasSuffix(".\($0)") }

            if !isTrusted {
                throw QRPayloadParserError.untrustedDomain(host)
            }

            // Check for suspicious patterns
            if urlString.contains("javascript:") ||
               urlString.contains("data:") ||
               urlString.contains("file:") {
                throw QRPayloadParserError.suspiciousURL
            }
        }
    }

    private func extractURL(from payload: QRPayload) -> String? {
        // Check various places where URLs might be
        if let url = payload.payload["redirect_uri"] as? String {
            return url
        }
        if let url = payload.payload["credential_issuer"] as? String {
            return url
        }
        if let url = payload.payload["iss"] as? String, url.hasPrefix("http") {
            return url
        }
        if let raw = payload.raw as? String, raw.hasPrefix("http") {
            return raw
        }
        return nil
    }

    // MARK: - Normalize Payload

    private func normalizePayload(_ payload: QRPayload) throws -> NormalizedQRPayload {
        return NormalizedQRPayload(
            type: payload.type,
            raw: payload.raw,
            header: payload.header,
            payload: payload.payload,
            signature: payload.signature,
            disclosures: payload.disclosures,
            metadata: extractMetadata(payload)
        )
    }

    private func extractMetadata(_ payload: QRPayload) -> PayloadMetadata {
        var metadata = PayloadMetadata()

        // Extract issuer
        if let iss = payload.payload["iss"] as? String {
            metadata.issuer = iss
        }

        // Extract expiration
        if let exp = payload.payload["exp"] as? TimeInterval {
            metadata.expirationDate = Date(timeIntervalSince1970: exp)
        }

        // Extract not before
        if let nbf = payload.payload["nbf"] as? TimeInterval {
            metadata.notBeforeDate = Date(timeIntervalSince1970: nbf)
        }

        // Extract nonce
        if let nonce = payload.payload["nonce"] as? String {
            metadata.nonce = nonce
        }

        // Extract client_id for OIDC requests
        if let clientId = payload.payload["client_id"] as? String {
            metadata.clientId = clientId
        }

        // Extract redirect_uri
        if let redirectUri = payload.payload["redirect_uri"] as? String {
            metadata.redirectUri = redirectUri
        }

        return metadata
    }
}

// MARK: - Task 11: Fetch VP Request Metadata

extension QRPayloadParser {
    /// Fetch VP Request metadata from backend if needed
    public func fetchVPRequestMetadata(_ payload: NormalizedQRPayload) async throws -> VPRequestMetadata? {
        guard payload.type == .oidcRequest else {
            return nil
        }

        // Extract authorization endpoint
        guard let redirectUri = payload.metadata.redirectUri,
              let url = URL(string: redirectUri) else {
            throw QRPayloadParserError.invalidRequestURL
        }

        // Construct metadata endpoint
        let metadataURL = url.appendingPathComponent("/.well-known/openid-configuration")

        // Fetch metadata
        let (data, _) = try await URLSession.shared.data(from: metadataURL)
        let metadata = try JSONDecoder().decode(VPRequestMetadata.self, from: data)

        return metadata
    }
}

// MARK: - Supporting Types

public struct NormalizedQRPayload {
    public let type: QRPayloadType
    public let raw: Any
    public let header: [String: Any]?
    public let payload: [String: Any]
    public let signature: String?
    public let disclosures: [String]?
    public let metadata: PayloadMetadata

    public init(
        type: QRPayloadType,
        raw: Any,
        header: [String: Any]?,
        payload: [String: Any],
        signature: String?,
        disclosures: [String]?,
        metadata: PayloadMetadata
    ) {
        self.type = type
        self.raw = raw
        self.header = header
        self.payload = payload
        self.signature = signature
        self.disclosures = disclosures
        self.metadata = metadata
    }
}

public struct PayloadMetadata {
    public var issuer: String?
    public var expirationDate: Date?
    public var notBeforeDate: Date?
    public var nonce: String?
    public var clientId: String?
    public var redirectUri: String?

    public init() {}
}

public struct VPRequestMetadata: Codable {
    public let authorizationEndpoint: String?
    public let tokenEndpoint: String?
    public let presentationDefinitionEndpoint: String?
    public let issuer: String?

    enum CodingKeys: String, CodingKey {
        case authorizationEndpoint = "authorization_endpoint"
        case tokenEndpoint = "token_endpoint"
        case presentationDefinitionEndpoint = "presentation_definition_endpoint"
        case issuer
    }
}

public enum QRPayloadParserError: Error, LocalizedError {
    case unknownPayloadType
    case missingRequiredField(String)
    case invalidNonce
    case suspiciousURL
    case untrustedDomain(String)
    case invalidRequestURL

    public var errorDescription: String? {
        switch self {
        case .unknownPayloadType:
            return "Unknown QR payload type"
        case .missingRequiredField(let field):
            return "Missing required field: \(field)"
        case .invalidNonce:
            return "Invalid nonce format"
        case .suspiciousURL:
            return "Suspicious URL detected"
        case .untrustedDomain(let domain):
            return "Untrusted domain: \(domain)"
        case .invalidRequestURL:
            return "Invalid request URL"
        }
    }
}




