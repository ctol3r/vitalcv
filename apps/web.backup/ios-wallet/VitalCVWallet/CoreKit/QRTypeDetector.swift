//
//  QRTypeDetector.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 12
//  Multiple QR type detectors (JWT-VC, SD-JWT, VP, OIDC offer)
//

import Foundation

/// QRTypeDetector - Detects and classifies QR code payload types
public class QRTypeDetector {
    public static let shared = QRTypeDetector()

    private init() {}

    // MARK: - Detection

    /// Detect QR code type
    public func detectType(_ payload: String) -> QRPayloadType {
        // Check for URL schemes
        if let url = URL(string: payload) {
            if url.scheme == "openid-vc" || url.scheme == "openid" {
                return .oidcOffer
            }
            if url.scheme == "openid-credential-offer" {
                return .oidcOffer
            }
            if url.scheme == "openid-credential-request" {
                return .oidcRequest
            }
        }

        // Check for JWT format (three parts separated by dots)
        let jwtParts = payload.components(separatedBy: ".")
        if jwtParts.count == 3 {
            // Try to decode JWT header
            if let headerData = Data(base64URLEncoded: jwtParts[0]),
               let header = try? JSONSerialization.jsonObject(with: headerData) as? [String: Any] {
                if let typ = header["typ"] as? String {
                    if typ == "jwt" || typ == "JWT" {
                        // Check if it's a VC or VP
                        if let payloadData = Data(base64URLEncoded: jwtParts[1]),
                           let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any] {
                            if payload["vc"] != nil {
                                return .jwtVC
                            }
                            if payload["vp"] != nil {
                                return .jwtVP
                            }
                        }
                        return .jwt
                    }
                }
            }
        }

        // Check for SD-JWT format (contains ~)
        if payload.contains("~") {
            // SD-JWT typically has format: header.payload~disclosure1~disclosure2~...
            let parts = payload.components(separatedBy: "~")
            if parts.count >= 2 {
                // Check if first part is a valid JWT
                if parts[0].components(separatedBy: ".").count == 3 {
                    return .sdJWT
                }
            }
        }

        // Check for JSON format
        if let data = payload.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if json["verifiableCredential"] != nil || json["vc"] != nil {
                return .jsonVC
            }
            if json["verifiablePresentation"] != nil || json["vp"] != nil {
                return .jsonVP
            }
            if json["credential_offer"] != nil {
                return .oidcOffer
            }
        }

        // Default to unknown
        return .unknown
    }

    /// Parse QR payload based on detected type
    public func parsePayload(_ payload: String) throws -> QRPayload {
        let type = detectType(payload)

        switch type {
        case .jwtVC, .jwtVP:
            return try parseJWTPayload(payload, type: type)
        case .sdJWT:
            return try parseSDJWTPayload(payload)
        case .oidcOffer:
            return try parseOIDCOffer(payload)
        case .oidcRequest:
            return try parseOIDCRequest(payload)
        case .jsonVC, .jsonVP:
            return try parseJSONPayload(payload, type: type)
        case .unknown:
            throw QRTypeDetectorError.unknownPayloadType
        }
    }

    // MARK: - Parsers

    private func parseJWTPayload(_ payload: String, type: QRPayloadType) throws -> QRPayload {
        let parts = payload.components(separatedBy: ".")
        guard parts.count == 3 else {
            throw QRTypeDetectorError.invalidJWTFormat
        }

        guard let headerData = Data(base64URLEncoded: parts[0]),
              let payloadData = Data(base64URLEncoded: parts[1]) else {
            throw QRTypeDetectorError.invalidJWTFormat
        }

        let header = try JSONSerialization.jsonObject(with: headerData) as? [String: Any] ?? [:]
        let payload = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any] ?? [:]

        return QRPayload(
            type: type,
            raw: payload,
            header: header,
            payload: payload,
            signature: parts[2]
        )
    }

    private func parseSDJWTPayload(_ payload: String) throws -> QRPayload {
        let parts = payload.components(separatedBy: "~")
        guard parts.count >= 2 else {
            throw QRTypeDetectorError.invalidSDJWTFormat
        }

        let jwtPart = parts[0]
        let disclosures = Array(parts[1...])

        // Parse JWT part
        let jwtParts = jwtPart.components(separatedBy: ".")
        guard jwtParts.count == 3,
              let headerData = Data(base64URLEncoded: jwtParts[0]),
              let payloadData = Data(base64URLEncoded: jwtParts[1]) else {
            throw QRTypeDetectorError.invalidSDJWTFormat
        }

        let header = try JSONSerialization.jsonObject(with: headerData) as? [String: Any] ?? [:]
        let payload = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any] ?? [:]

        return QRPayload(
            type: .sdJWT,
            raw: payload,
            header: header,
            payload: payload,
            signature: jwtParts[2],
            disclosures: disclosures
        )
    }

    private func parseOIDCOffer(_ payload: String) throws -> QRPayload {
        // Parse OIDC offer URL or JSON
        if let url = URL(string: payload) {
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            var params: [String: Any] = [:]

            for item in components?.queryItems ?? [] {
                params[item.name] = item.value
            }

            return QRPayload(
                type: .oidcOffer,
                raw: params,
                header: nil,
                payload: params,
                signature: nil
            )
        } else if let data = payload.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return QRPayload(
                type: .oidcOffer,
                raw: json,
                header: nil,
                payload: json,
                signature: nil
            )
        }

        throw QRTypeDetectorError.invalidOIDCOffer
    }

    private func parseOIDCRequest(_ payload: String) throws -> QRPayload {
        // Similar to OIDC offer
        if let url = URL(string: payload) {
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            var params: [String: Any] = [:]

            for item in components?.queryItems ?? [] {
                params[item.name] = item.value
            }

            return QRPayload(
                type: .oidcRequest,
                raw: params,
                header: nil,
                payload: params,
                signature: nil
            )
        }

        throw QRTypeDetectorError.invalidOIDCRequest
    }

    private func parseJSONPayload(_ payload: String, type: QRPayloadType) throws -> QRPayload {
        guard let data = payload.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw QRTypeDetectorError.invalidJSONFormat
        }

        return QRPayload(
            type: type,
            raw: json,
            header: nil,
            payload: json,
            signature: nil
        )
    }
}

// MARK: - Supporting Types

public enum QRPayloadType: String {
    case jwtVC = "jwt-vc"
    case jwtVP = "jwt-vp"
    case sdJWT = "sd-jwt"
    case oidcOffer = "oidc-offer"
    case oidcRequest = "oidc-request"
    case jsonVC = "json-vc"
    case jsonVP = "json-vp"
    case unknown = "unknown"
}

public struct QRPayload {
    public let type: QRPayloadType
    public let raw: Any
    public let header: [String: Any]?
    public let payload: [String: Any]
    public let signature: String?
    public let disclosures: [String]?

    public init(type: QRPayloadType, raw: Any, header: [String: Any]?, payload: [String: Any], signature: String?, disclosures: [String]? = nil) {
        self.type = type
        self.raw = raw
        self.header = header
        self.payload = payload
        self.signature = signature
        self.disclosures = disclosures
    }
}

public enum QRTypeDetectorError: Error, LocalizedError {
    case unknownPayloadType
    case invalidJWTFormat
    case invalidSDJWTFormat
    case invalidOIDCOffer
    case invalidOIDCRequest
    case invalidJSONFormat

    public var errorDescription: String? {
        switch self {
        case .unknownPayloadType:
            return "Unknown QR payload type"
        case .invalidJWTFormat:
            return "Invalid JWT format"
        case .invalidSDJWTFormat:
            return "Invalid SD-JWT format"
        case .invalidOIDCOffer:
            return "Invalid OIDC offer format"
        case .invalidOIDCRequest:
            return "Invalid OIDC request format"
        case .invalidJSONFormat:
            return "Invalid JSON format"
        }
    }
}

// MARK: - Extensions

extension Data {
    init?(base64URLEncoded string: String) {
        let base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        // Add padding if needed
        let padding = base64.count % 4
        let paddedBase64 = padding > 0 ? base64 + String(repeating: "=", count: 4 - padding) : base64

        self.init(base64Encoded: paddedBase64)
    }
}








