//
//  OIDC4VPService.swift
//  VitalCVWallet
//
//  Created: Batch 129 - Task 11-15
//  OIDC4VP wallet presentation builder and verification flow
//

import Foundation

/// OIDC4VPService - OIDC4VP wallet presentation builder
public class OIDC4VPService {
    public static let shared = OIDC4VPService()

    private init() {}

    // MARK: - Task 11: Wallet Presentation Builder

    /// Build verifiable presentation from credentials
    public func buildPresentation(
        credentials: [VerifiableCredential],
        requestedClaims: [String: [String]]? = nil
    ) async throws -> VerifiablePresentation {
        // Build presentation with selected credentials
        let vp = VerifiablePresentation(
            id: UUID().uuidString,
            type: ["VerifiablePresentation"],
            verifiableCredential: credentials,
            holder: DIDService.shared.getDID()?.id ?? "did:holder",
            proof: nil,
            nonce: nil,
            challenge: nil
        )

        return vp
    }

    // MARK: - Task 12: Nonce-Challenge UI

    /// Generate nonce for presentation request
    public func generateNonce() -> String {
        return UUID().uuidString.replacingOccurrences(of: "-", with: "")
    }

    /// Validate challenge from verifier
    public func validateChallenge(_ challenge: String, nonce: String) -> Bool {
        // In production, validate cryptographic challenge
        return !challenge.isEmpty && !nonce.isEmpty
    }

    // MARK: - Task 13: Dynamic VP Request Renderer

    /// Parse and render VP request from QR code or deep link
    public func parseVPRequest(_ request: String) throws -> VPRequest {
        // Parse request (could be JWT, URL, or JSON)
        if let url = URL(string: request),
           url.scheme == "openid-vc" || url.scheme == "openid" {
            return try parseVPRequestFromURL(url)
        }

        // Try parsing as JWT
        if request.contains(".") {
            return try parseVPRequestFromJWT(request)
        }

        // Try parsing as JSON
        if let data = request.data(using: .utf8) {
            return try JSONDecoder().decode(VPRequest.self, from: data)
        }

        throw OIDC4VPError.invalidRequestFormat
    }

    private func parseVPRequestFromURL(_ url: URL) throws -> VPRequest {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        guard let queryItems = components?.queryItems else {
            throw OIDC4VPError.invalidRequestFormat
        }

        var clientId: String?
        var redirectURI: String?
        var nonce: String?
        var state: String?

        for item in queryItems {
            switch item.name {
            case "client_id":
                clientId = item.value
            case "redirect_uri":
                redirectURI = item.value
            case "nonce":
                nonce = item.value
            case "state":
                state = item.value
            default:
                break
            }
        }

        guard let client = clientId else {
            throw OIDC4VPError.missingClientId
        }

        return VPRequest(
            clientId: client,
            redirectURI: redirectURI,
            nonce: nonce ?? generateNonce(),
            state: state,
            presentationDefinition: nil,
            challenge: generateNonce()
        )
    }

    private func parseVPRequestFromJWT(_ jwt: String) throws -> VPRequest {
        // Decode JWT (simplified - in production use proper JWT library)
        let parts = jwt.components(separatedBy: ".")
        guard parts.count >= 2 else {
            throw OIDC4VPError.invalidRequestFormat
        }

        // Decode payload (base64url)
        guard let payloadData = Data(base64Encoded: parts[1], options: .ignoreUnknownCharacters),
              let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any] else {
            throw OIDC4VPError.invalidRequestFormat
        }

        return VPRequest(
            clientId: payload["client_id"] as? String ?? "",
            redirectURI: payload["redirect_uri"] as? String,
            nonce: payload["nonce"] as? String ?? generateNonce(),
            state: payload["state"] as? String,
            presentationDefinition: payload["presentation_definition"] as? PresentationDefinition,
            challenge: payload["challenge"] as? String ?? generateNonce()
        )
    }

    // MARK: - Task 14: VP Submission Endpoint

    /// Submit verifiable presentation to verifier
    public func submitPresentation(
        _ presentation: VerifiablePresentation,
        to endpoint: URL,
        with request: VPRequest
    ) async throws -> VPSubmissionResult {
        // Build submission payload
        let submission = VPSubmission(
            presentation: presentation,
            state: request.state,
            nonce: request.nonce
        )

        // Encode as JWT or JSON (depending on format)
        let payload = try JSONEncoder().encode(submission)

        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = payload

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw OIDC4VPError.submissionFailed
        }

        if httpResponse.statusCode == 200 {
            let result = try JSONDecoder().decode(VPSubmissionResult.self, from: data)
            return result
        } else {
            let error = try? JSONDecoder().decode(VPError.self, from: data)
            throw OIDC4VPError.verificationFailed(error?.errorDescription ?? "Unknown error")
        }
    }

    // MARK: - Task 15: Real-time Proof Result UI State

    /// Monitor verification status
    public func monitorVerificationStatus(
        submissionId: String,
        endpoint: URL
    ) async throws -> VPVerificationStatus {
        let statusURL = endpoint.appendingPathComponent("status/\(submissionId)")
        let (data, _) = try await URLSession.shared.data(from: statusURL)
        return try JSONDecoder().decode(VPVerificationStatus.self, from: data)
    }
}

// MARK: - Models

public struct VerifiablePresentation: Codable {
    public let id: String
    public let type: [String]
    public let verifiableCredential: [VerifiableCredential]
    public let holder: String
    public let proof: Proof?
    public let nonce: String?
    public let challenge: String?
}

public struct VPRequest: Codable {
    public let clientId: String
    public let redirectURI: String?
    public let nonce: String
    public let state: String?
    public let presentationDefinition: PresentationDefinition?
    public let challenge: String
}

public struct PresentationDefinition: Codable {
    public let id: String?
    public let inputDescriptors: [InputDescriptor]?
}

public struct InputDescriptor: Codable {
    public let id: String
    public let name: String?
    public let purpose: String?
    public let constraints: Constraints?
}

public struct Constraints: Codable {
    public let fields: [Field]?
}

public struct Field: Codable {
    public let path: [String]
    public let filter: [String: AnyCodable]?
}

public struct VPSubmission: Codable {
    public let presentation: VerifiablePresentation
    public let state: String?
    public let nonce: String
}

public struct VPSubmissionResult: Codable {
    public let submissionId: String
    public let status: String
    public let verified: Bool?
    public let error: String?
}

public struct VPVerificationStatus: Codable {
    public let status: String
    public let verified: Bool
    public let checks: [VerificationCheck]?
    public let timestamp: Date
}

public struct VPError: Codable {
    public let error: String
    public let errorDescription: String?
}

public enum OIDC4VPError: Error {
    case invalidRequestFormat
    case missingClientId
    case submissionFailed
    case verificationFailed(String)
}

// Helper for AnyCodable
public struct AnyCodable: Codable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable value cannot be decoded")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "AnyCodable value cannot be encoded"))
        }
    }
}

