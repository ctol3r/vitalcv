//
//  IssuerMetadataFetcher.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Task 14
//  Add IssuerMetadataFetcher service
//

import Foundation

/// IssuerMetadataFetcher - Fetches issuer metadata from backend
public class IssuerMetadataFetcher {
    public static let shared = IssuerMetadataFetcher()

    private let networkService: AsyncNetworkService
    private var metadataCache: [String: IssuerMetadata] = [:]

    private init() {
        self.networkService = AsyncNetworkService.shared
    }

    /// Fetch issuer metadata by DID
    public func fetchMetadata(for issuerDID: String) async throws -> IssuerMetadata {
        // Check cache first
        if let cached = metadataCache[issuerDID] {
            return cached
        }

        let baseURL = EnvironmentConfig.shared.apiBaseURL
        let endpoint = URL(string: "\(baseURL)/api/issuer/metadata/\(issuerDID)")!

        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw IssuerMetadataError.fetchFailed
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let metadata = try decoder.decode(IssuerMetadata.self, from: data)

        // Cache metadata
        metadataCache[issuerDID] = metadata

        return metadata
    }

    /// Clear cache for issuer
    public func clearCache(for issuerDID: String) {
        metadataCache.removeValue(forKey: issuerDID)
    }

    /// Clear all cache
    public func clearAllCache() {
        metadataCache.removeAll()
    }
}

// MARK: - Models

public struct IssuerMetadata: Codable {
    public let did: String
    public let name: String
    public let description: String?
    public let logo: String?
    public let website: String?
    public let trusted: Bool
    public let complianceLevel: ComplianceLevel
    public let supportedFormats: [String]
    public let createdAt: Date
    public let updatedAt: Date?
}

public enum ComplianceLevel: String, Codable {
    case high
    case medium
    case low
    case unknown
}

public enum IssuerMetadataError: Error {
    case fetchFailed
    case invalidResponse
    case networkError(Error)
}

