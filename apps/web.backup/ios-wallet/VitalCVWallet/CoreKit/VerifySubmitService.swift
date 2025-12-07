//
//  VerifySubmitService.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 12
//  Implement VP submission call (/verify-submit)
//

import Foundation

/// VerifySubmitService - Handles verifiable presentation submission
public class VerifySubmitService {
    public static let shared = VerifySubmitService()

    private let networkService: AsyncNetworkService

    private init() {
        self.networkService = AsyncNetworkService.shared
    }

    /// Submit verifiable presentation for verification
    public func submitPresentation(
        presentation: VerifiablePresentation,
        sessionId: String,
        request: OIDC4VPRequest
    ) async throws -> VerifySubmitResponse {
        let baseURL = EnvironmentConfig.shared.apiBaseURL
        let endpoint = URL(string: "\(baseURL)/api/verify-submit")!

        // Build request payload
        let payload: [String: Any] = [
            "session_id": sessionId,
            "presentation": try encodePresentation(presentation),
            "state": request.state ?? "",
            "nonce": request.nonce
        ]

        // Generate DPoP token
        let dpopToken = try DPoPSigner.shared.generateDPoPToken(
            method: "POST",
            url: endpoint
        )

        // Create URL request
        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("DPoP \(dpopToken)", forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: payload)

        // Make request
        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw VerifySubmitError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw VerifySubmitError.backendError(errorMessage)
        }

        // Decode response
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(VerifySubmitResponse.self, from: data)
    }

    private func encodePresentation(_ presentation: VerifiablePresentation) throws -> [String: Any] {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(presentation)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
}

// MARK: - Models

public struct VerifySubmitResponse: Codable {
    public let verified: Bool
    public let verificationId: String
    public let checks: [VerificationCheck]
    public let trustScore: Double?
    public let timestamp: Date
    public let error: String?
}

public enum VerifySubmitError: Error {
    case invalidResponse
    case backendError(String)
    case networkError(Error)
}

