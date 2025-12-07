//
//  OIDC4VPRequest.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 9
//  OIDC4VPRequest model (nonce, clientID, redirect)
//

import Foundation

/// OIDC4VPRequest - Model for OIDC4VP verification requests
public struct OIDC4VPRequest: Codable, Equatable {
    public let nonce: String
    public let clientID: String
    public let redirectURI: String?
    public let state: String?
    public let presentationDefinition: PresentationDefinition?
    public let challenge: String?
    public let responseType: String?
    public let scope: String?

    public init(
        nonce: String,
        clientID: String,
        redirectURI: String? = nil,
        state: String? = nil,
        presentationDefinition: PresentationDefinition? = nil,
        challenge: String? = nil,
        responseType: String? = nil,
        scope: String? = nil
    ) {
        self.nonce = nonce
        self.clientID = clientID
        self.redirectURI = redirectURI
        self.state = state
        self.presentationDefinition = presentationDefinition
        self.challenge = challenge
        self.responseType = responseType ?? "vp_token"
        self.scope = scope ?? "openid"
    }

    /// Parse OIDC4VPRequest from QR code string
    public static func parse(from qrString: String) throws -> OIDC4VPRequest {
        // Try parsing as URL
        if let url = URL(string: qrString),
           url.scheme == "openid-vc" || url.scheme == "openid" {
            return try parseFromURL(url)
        }

        // Try parsing as JWT
        if qrString.contains(".") {
            return try parseFromJWT(qrString)
        }

        // Try parsing as JSON
        if let data = qrString.data(using: .utf8) {
            return try JSONDecoder().decode(OIDC4VPRequest.self, from: data)
        }

        throw OIDC4VPRequestError.invalidFormat
    }

    private static func parseFromURL(_ url: URL) throws -> OIDC4VPRequest {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let queryItems = components.queryItems else {
            throw OIDC4VPRequestError.invalidFormat
        }

        var clientID: String?
        var redirectURI: String?
        var nonce: String?
        var state: String?
        var challenge: String?

        for item in queryItems {
            switch item.name {
            case "client_id":
                clientID = item.value
            case "redirect_uri":
                redirectURI = item.value
            case "nonce":
                nonce = item.value
            case "state":
                state = item.value
            case "challenge":
                challenge = item.value
            default:
                break
            }
        }

        guard let client = clientID else {
            throw OIDC4VPRequestError.missingClientID
        }

        return OIDC4VPRequest(
            nonce: nonce ?? UUID().uuidString.replacingOccurrences(of: "-", with: ""),
            clientID: client,
            redirectURI: redirectURI,
            state: state,
            challenge: challenge
        )
    }

    private static func parseFromJWT(_ jwt: String) throws -> OIDC4VPRequest {
        let parts = jwt.components(separatedBy: ".")
        guard parts.count >= 2 else {
            throw OIDC4VPRequestError.invalidFormat
        }

        // Decode payload (base64url)
        var base64String = parts[1]
        base64String = base64String.replacingOccurrences(of: "-", with: "+")
        base64String = base64String.replacingOccurrences(of: "_", with: "/")

        // Add padding if needed
        let remainder = base64String.count % 4
        if remainder > 0 {
            base64String = base64String.padding(toLength: base64String.count + 4 - remainder, withPad: "=", startingAt: 0)
        }

        guard let payloadData = Data(base64Encoded: base64String),
              let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any] else {
            throw OIDC4VPRequestError.invalidFormat
        }

        return OIDC4VPRequest(
            nonce: payload["nonce"] as? String ?? UUID().uuidString.replacingOccurrences(of: "-", with: ""),
            clientID: payload["client_id"] as? String ?? "",
            redirectURI: payload["redirect_uri"] as? String,
            state: payload["state"] as? String,
            challenge: payload["challenge"] as? String
        )
    }
}

public enum OIDC4VPRequestError: Error {
    case invalidFormat
    case missingClientID
    case invalidURL
}

