//
//  ClipNetworkService.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 3 - Task 21
//  Network service for App Clip backend communication
//

import Foundation

/// Lightweight network service for App Clip
class ClipNetworkService {
    static let shared = ClipNetworkService()

    let baseURL: String
    private let session: URLSession

    private init() {
        // Get base URL from environment or default
        self.baseURL = EnvironmentConfig.shared.apiBaseURL
        self.session = URLSession(configuration: .ephemeral)
    }

    // MARK: - Task 21: Backend /verify-init Support

    /// Initialize verification session
    func initializeVerification(payload: QRPayload) async throws -> VerificationSession {
        let endpoint = "/api/verify-init"

        let requestBody: [String: Any] = [
            "payload": payload.rawValue,
            "type": payload.type.rawValue,
            "source": "app-clip"
        ]

        let response: VerificationInitResponse = try await post(endpoint: endpoint, body: requestBody)

        return VerificationSession(
            sessionId: response.sessionId,
            nonce: response.nonce,
            challenge: response.challenge
        )
    }

    // MARK: - Task 22: Submit VP with DPoP

    /// Submit verifiable presentation with DPoP proof
    func submitVP(vp: VerifiablePresentation, session: VerificationSession, dpopProof: String) async throws -> ProofSubmissionResponse {
        let endpoint = "/api/verify-submit"

        let requestBody: [String: Any] = [
            "sessionId": session.sessionId,
            "vp": encodeVP(vp),
            "dpopProof": dpopProof
        ]

        return try await post(endpoint: endpoint, body: requestBody)
    }

    // MARK: - Generic HTTP Methods

    func get<T: Decodable>(endpoint: String) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.serverError
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    func post<T: Decodable>(endpoint: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.serverError
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func encodeVP(_ vp: VerifiablePresentation) -> [String: Any] {
        // Encode VP to dictionary
        return [
            "id": vp.id,
            "type": vp.type,
            "holder": vp.holder
        ]
    }
}

// MARK: - Network Error

enum NetworkError: Error, LocalizedError {
    case invalidURL
    case serverError
    case decodingError

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .serverError:
            return "Server error"
        case .decodingError:
            return "Failed to decode response"
        }
    }
}

// MARK: - Response Types

struct VerificationInitResponse: Codable {
    let sessionId: String
    let nonce: String
    let challenge: String
}

struct ProofSubmissionResponse: Codable {
    let proofId: String
    let status: String
    let vpReceipt: String?
}

