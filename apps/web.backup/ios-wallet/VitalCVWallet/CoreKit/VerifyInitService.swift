//
//  VerifyInitService.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 10
//  Implement /verify-init call to backend
//

import Foundation

/// VerifyInitService - Handles verification initialization with backend
public class VerifyInitService {
    public static let shared = VerifyInitService()

    private let networkService: AsyncNetworkService

    private init() {
        self.networkService = AsyncNetworkService.shared
    }

    /// Initialize verification session with backend
    public func initializeVerification(
        request: OIDC4VPRequest
    ) async throws -> VerifyInitResponse {
        let baseURL = EnvironmentConfig.shared.apiBaseURL
        let endpoint = URL(string: "\(baseURL)/api/verify-init")!

        // Build request payload
        let payload: [String: Any] = [
            "nonce": request.nonce,
            "client_id": request.clientID,
            "redirect_uri": request.redirectURI ?? "",
            "state": request.state ?? "",
            "challenge": request.challenge ?? ""
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
            throw VerifyInitError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw VerifyInitError.backendError(errorMessage)
        }

        // Decode response
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(VerifyInitResponse.self, from: data)
    }
}

// MARK: - Models

public struct VerifyInitResponse: Codable {
    public let sessionId: String
    public let verificationEndpoint: String
    public let expiresAt: Date
    public let requiredClaims: [String]?
    public let issuerWhitelist: [String]?
}

public enum VerifyInitError: Error {
    case invalidResponse
    case backendError(String)
    case networkError(Error)
}

