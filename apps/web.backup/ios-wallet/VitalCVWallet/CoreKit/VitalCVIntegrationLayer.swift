//
//  VitalCVIntegrationLayer.swift
//  VitalCVWallet
//
//  Created: Batch 135-A - Task 1
//  Unified integration layer connecting iOS app to all backend services
//

import Foundation
import Combine

/// VitalCVIntegrationLayer - Central integration point for all backend services
/// Coordinates DID, OIDC4VCI, OIDC4VP, SD-JWT, BBS+, blockchain, evidence, and jobs
public actor VitalCVIntegrationLayer {
    public static let shared = VitalCVIntegrationLayer()

    private let networkClient: NetworkClient
    private let didService: DIDService
    private let dpopSigner: DPoPSigner
    private let oidc4VCIService: OIDC4VCIService
    private var sessionToken: String?
    private var biometricUnlocked: Bool = false

    private init() {
        self.networkClient = NetworkClient.shared
        self.didService = DIDService.shared
        self.dpopSigner = DPoPSigner.shared
        self.oidc4VCIService = OIDC4VCIService.shared
    }

    // MARK: - Environment Configuration

    /// Current environment (dev/stage/prod)
    public var environment: EnvironmentConfig.Environment {
        EnvironmentConfig.shared.environment
    }

    /// API base URL for current environment
    public var apiBaseURL: String {
        EnvironmentConfig.shared.apiBaseURL
    }

    // MARK: - Session Management

    /// Set session token for authenticated requests
    public func setSessionToken(_ token: String?) {
        self.sessionToken = token
        networkClient.setAuthToken(token)
    }

    /// Clear session (logout)
    public func clearSession() {
        self.sessionToken = nil
        self.biometricUnlocked = false
        networkClient.setAuthToken(nil)
    }

    /// Unlock session with biometric authentication
    public func unlockWithBiometric() async -> Bool {
        let authService = BiometricAuthService.shared
        let result = await authService.authenticate(reason: "Unlock VitalCV Wallet")
        if result {
            self.biometricUnlocked = true
        }
        return result
    }

    /// Check if session is unlocked
    public var isSessionUnlocked: Bool {
        biometricUnlocked && sessionToken != nil
    }

    // MARK: - Health Check

    /// Check backend health
    public func checkHealth() async throws -> HealthResponse {
        let response: HealthResponse = try await networkClient.get("/health")
        return response
    }
}

// MARK: - Network Client with Interceptor Pipeline

/// NetworkClient with interceptor pipeline for DPoP, retries, and error handling
public actor NetworkClient {
    public static let shared = NetworkClient()

    private var baseURL: String
    private var authToken: String?
    private let session: URLSession
    private var interceptors: [NetworkInterceptor] = []
    private var retryPolicy: RetryPolicy = RetryPolicy.default

    private init() {
        self.baseURL = EnvironmentConfig.shared.apiBaseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
        self.setupDefaultInterceptors()
    }

    /// Update base URL (for environment switching)
    public func setBaseURL(_ url: String) {
        self.baseURL = url
    }

    /// Set authentication token
    public func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    /// Setup default interceptors (DPoP, retry, error handling)
    private func setupDefaultInterceptors() {
        self.interceptors = [
            DPoPInterceptor(),
            RetryInterceptor(policy: retryPolicy),
            ErrorHandlingInterceptor()
        ]
    }

    /// Add custom interceptor
    public func addInterceptor(_ interceptor: NetworkInterceptor) {
        self.interceptors.append(interceptor)
    }

    // MARK: - Request Methods

    /// Generic GET request
    public func get<T: Decodable>(_ endpoint: String, headers: [String: String] = [:]) async throws -> T {
        try await request(endpoint: endpoint, method: .GET, headers: headers)
    }

    /// Generic POST request
    public func post<T: Decodable, U: Encodable>(_ endpoint: String, body: U, headers: [String: String] = [:]) async throws -> T {
        try await request(endpoint: endpoint, method: .POST, body: body, headers: headers)
    }

    /// Generic PUT request
    public func put<T: Decodable, U: Encodable>(_ endpoint: String, body: U, headers: [String: String] = [:]) async throws -> T {
        try await request(endpoint: endpoint, method: .PUT, body: body, headers: headers)
    }

    /// Generic DELETE request
    public func delete(_ endpoint: String, headers: [String: String] = [:]) async throws {
        let _: EmptyResponse = try await request(endpoint: endpoint, method: .DELETE, headers: headers)
    }

    // MARK: - Internal Request Handler

    private func request<T: Decodable, U: Encodable>(
        endpoint: String,
        method: HTTPMethod,
        body: U? = nil,
        headers: [String: String] = [:]
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw IntegrationError.invalidURL(endpoint)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Add auth token if available
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Add custom headers
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Encode body if provided
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        // Apply interceptors (pre-request)
        var interceptedRequest = request
        for interceptor in interceptors {
            interceptedRequest = try await interceptor.interceptRequest(interceptedRequest)
        }

        // Execute request with retries
        var lastError: Error?
        var attempt = 0

        while attempt <= retryPolicy.maxRetries {
            do {
                let (data, response) = try await session.data(for: interceptedRequest)

                guard let httpResponse = response as? HTTPURLResponse else {
                    throw IntegrationError.invalidResponse
                }

                // Apply interceptors (post-response)
                var interceptedResponse = (data: data, response: httpResponse)
                for interceptor in interceptors {
                    interceptedResponse = try await interceptor.interceptResponse(
                        interceptedResponse.data,
                        interceptedResponse.response
                    )
                }

                // Check status code
                guard (200...299).contains(httpResponse.statusCode) else {
                    let errorMessage = String(data: interceptedResponse.data, encoding: .utf8)
                    throw IntegrationError.httpError(httpResponse.statusCode, errorMessage)
                }

                // Decode response
                return try JSONDecoder().decode(T.self, from: interceptedResponse.data)

            } catch {
                lastError = error
                attempt += 1

                // Check if should retry
                if attempt <= retryPolicy.maxRetries,
                   shouldRetry(error: error, statusCode: (response as? HTTPURLResponse)?.statusCode) {
                    let delay = retryPolicy.delay(for: attempt)
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    continue
                } else {
                    throw error
                }
            }
        }

        throw lastError ?? IntegrationError.unknown
    }

    private func shouldRetry(error: Error, statusCode: Int?) -> Bool {
        // Retry on network errors or 5xx status codes
        if let statusCode = statusCode {
            return (500...599).contains(statusCode)
        }
        return true
    }
}

// MARK: - Network Interceptors

protocol NetworkInterceptor {
    func interceptRequest(_ request: URLRequest) async throws -> URLRequest
    func interceptResponse(_ data: Data, _ response: HTTPURLResponse) async throws -> (Data, HTTPURLResponse)
}

/// DPoP Interceptor - Adds DPoP proof to authenticated requests
struct DPoPInterceptor: NetworkInterceptor {
    func interceptRequest(_ request: URLRequest) async throws -> URLRequest {
        // Only add DPoP if Authorization header is present
        guard request.value(forHTTPHeaderField: "Authorization") != nil,
              let url = request.url else {
            return request
        }

        let method = request.httpMethod ?? "GET"

        // Extract access token from Authorization header
        let authHeader = request.value(forHTTPHeaderField: "Authorization") ?? ""
        let accessToken = authHeader.replacingOccurrences(of: "Bearer ", with: "")

        // Generate DPoP proof
        let dpopProof = try DPoPSigner.shared.generateDPoPToken(
            method: method,
            url: url,
            accessToken: accessToken.isEmpty ? nil : accessToken
        )

        var modifiedRequest = request
        modifiedRequest.setValue(dpopProof, forHTTPHeaderField: "DPoP")
        return modifiedRequest
    }

    func interceptResponse(_ data: Data, _ response: HTTPURLResponse) async throws -> (Data, HTTPURLResponse) {
        return (data, response)
    }
}

/// Retry Interceptor - Handles retry logic
struct RetryInterceptor: NetworkInterceptor {
    let policy: RetryPolicy

    func interceptRequest(_ request: URLRequest) async throws -> URLRequest {
        return request
    }

    func interceptResponse(_ data: Data, _ response: HTTPURLResponse) async throws -> (Data, HTTPURLResponse) {
        return (data, response)
    }
}

/// Error Handling Interceptor - Maps errors to user-friendly messages
struct ErrorHandlingInterceptor: NetworkInterceptor {
    func interceptRequest(_ request: URLRequest) async throws -> URLRequest {
        return request
    }

    func interceptResponse(_ data: Data, _ response: HTTPURLResponse) async throws -> (Data, HTTPURLResponse) {
        // If error response, try to parse error message
        if !(200...299).contains(response.statusCode),
           let errorData = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
            await MainActor.run {
                ErrorHandler.shared.handle(
                    IntegrationError.httpError(response.statusCode, errorData.message),
                    context: "Backend API"
                )
            }
        }
        return (data, response)
    }
}

// MARK: - Retry Policy

struct RetryPolicy {
    let maxRetries: Int
    let initialDelay: TimeInterval
    let maxDelay: TimeInterval
    let backoffMultiplier: Double

    static let `default` = RetryPolicy(
        maxRetries: 3,
        initialDelay: 1.0,
        maxDelay: 10.0,
        backoffMultiplier: 2.0
    )

    func delay(for attempt: Int) -> TimeInterval {
        let delay = initialDelay * pow(backoffMultiplier, Double(attempt - 1))
        return min(delay, maxDelay)
    }
}

// MARK: - Error Types

enum IntegrationError: LocalizedError {
    case invalidURL(String)
    case invalidResponse
    case httpError(Int, String?)
    case networkError(Error)
    case decodingError(DecodingError)
    case encodingError(Error)
    case unauthorized
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL(let endpoint):
            return "Invalid URL: \(endpoint)"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code, let message):
            return "HTTP \(code): \(message ?? "Unknown error")"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .encodingError(let error):
            return "Encoding error: \(error.localizedDescription)"
        case .unauthorized:
            return "Unauthorized - please authenticate"
        case .unknown:
            return "Unknown error occurred"
        }
    }
}

// MARK: - Response Models

struct HealthResponse: Codable {
    let ok: Bool
    let service: String?
    let time: String?
    let version: String?
}

struct APIErrorResponse: Codable {
    let error: String?
    let message: String?
    let code: String?
}

struct EmptyResponse: Codable {}

enum HTTPMethod: String {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
    case PATCH = "PATCH"
}
