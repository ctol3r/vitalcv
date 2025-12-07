//
//  AsyncNetworkService.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 2
//  Unified async/await network service
//

import Foundation

/// AsyncNetworkService with full Swift concurrency and thread isolation
/// Batch 551 - Task 2: Full Swift concurrency adoption
/// Batch 551 - Task 3: Thread isolations (IO actor for network operations)
actor AsyncNetworkService {
    static let shared = AsyncNetworkService()

    nonisolated(unsafe) var baseURL: String
    private let session: URLSession
    private var requestCache: [String: (data: Data, timestamp: Date)] = [:]
    private let cacheTimeout: TimeInterval = 300 // 5 minutes

    private init() {
        self.baseURL = EnvironmentConfig.shared.apiBaseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.requestCachePolicy = .returnCacheDataElseLoad
        // Use dedicated queue for network operations (IO thread)
        config.urlCache = URLCache(
            memoryCapacity: 10 * 1024 * 1024, // 10MB
            diskCapacity: 50 * 1024 * 1024,   // 50MB
            diskPath: "vitalcv_network_cache"
        )
        self.session = URLSession(configuration: config)
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .GET,
        body: (any Encodable)? = nil,
        headers: [String: String] = [:],
        cachePolicy: CachePolicy = .default
    ) async throws -> T {
        let cacheKey = "\(method.rawValue):\(endpoint)"

        // Check cache first
        if cachePolicy == .cacheFirst,
           let cached = requestCache[cacheKey],
           Date().timeIntervalSince(cached.timestamp) < cacheTimeout {
            return try JSONDecoder().decode(T.self, from: cached.data)
        }

        guard let url = URL(string: baseURL + endpoint) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Add custom headers
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Add body if provided
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        do {
            // Network I/O happens on background thread (isolated to actor)
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw NetworkError.invalidResponse
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMessage = String(data: data, encoding: .utf8)
                // Report error to ErrorHandler on main thread
                await MainActor.run {
                    ErrorHandler.shared.handle(
                        NetworkError.httpError(httpResponse.statusCode, errorMessage),
                        context: endpoint
                    )
                }
                throw NetworkError.httpError(httpResponse.statusCode, errorMessage)
            }

            // Cache successful responses (actor-isolated)
            if cachePolicy != .noCache {
                requestCache[cacheKey] = (data, Date())
            }

            // Decoding happens on actor's thread (IO thread)
            return try JSONDecoder().decode(T.self, from: data)
        } catch let error as DecodingError {
            // Report decoding error
            await MainActor.run {
                ErrorHandler.shared.handle(error, context: "Decoding response from \(endpoint)")
            }
            throw NetworkError.decodingError(error)
        } catch {
            // Report network error
            await MainActor.run {
                ErrorHandler.shared.handle(error, context: "Network request to \(endpoint)")
            }
            throw NetworkError.networkError(error)
        }
    }

    // MARK: - Convenience Methods

    func get<T: Decodable>(_ endpoint: String, cachePolicy: CachePolicy = .default) async throws -> T {
        try await request(endpoint: endpoint, method: .GET, cachePolicy: cachePolicy)
    }

    func post<T: Decodable, U: Encodable>(_ endpoint: String, body: U, cachePolicy: CachePolicy = .noCache) async throws -> T {
        try await request(endpoint: endpoint, method: .POST, body: body, cachePolicy: cachePolicy)
    }

    func put<T: Decodable, U: Encodable>(_ endpoint: String, body: U) async throws -> T {
        try await request(endpoint: endpoint, method: .PUT, body: body)
    }

    func delete(_ endpoint: String) async throws {
        let _: EmptyResponse = try await request(endpoint: endpoint, method: .DELETE)
    }

    // MARK: - Cache Management

    func clearCache() {
        requestCache.removeAll()
    }

    func clearCache(for endpoint: String) {
        requestCache.removeValue(forKey: endpoint)
    }
}

// MARK: - Supporting Types

enum HTTPMethod: String {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
    case PATCH = "PATCH"
}

enum CachePolicy {
    case `default`
    case cacheFirst
    case noCache
}

enum NetworkError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int, String?)
    case networkError(Error)
    case decodingError(DecodingError)
    case encodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response"
        case .httpError(let code, let message):
            return "HTTP \(code): \(message ?? "Unknown error")"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .encodingError(let error):
            return "Encoding error: \(error.localizedDescription)"
        }
    }
}

struct EmptyResponse: Codable {}

