//
//  FinancialIdentityEngine.swift
//  VitalCVWallet
//
//  Created: Clinician Financial Identity Engine - Phase 1
//  Financial identity substrate: TIN, NPI, W-9, payer linkages
//

import Foundation
import CryptoKit
import Combine

/// Financial Identity Engine - Core service for managing clinician financial identity
@MainActor
public class FinancialIdentityEngine: ObservableObject {
    public static let shared = FinancialIdentityEngine()

    // MARK: - Published State

    @Published public var financialIdentity: FinancialIdentity?
    @Published public var isLoading = false
    @Published public var error: Error?

    // MARK: - Configuration

    private let apiBaseURL: String
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        // Get API base URL from environment or defaults
        self.apiBaseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:4000"
    }

    // MARK: - Phase 1: Financial Identity Core

    /// Fetch financial identity by clinician ID or NPI
    public func fetchFinancialIdentity(clinicianId: String? = nil, npi: String? = nil) async throws {
        isLoading = true
        error = nil

        defer { isLoading = false }

        var urlComponents = URLComponents(string: "\(apiBaseURL)/api/financial/identity/fetch")!
        var queryItems: [URLQueryItem] = []

        if let clinicianId = clinicianId {
            queryItems.append(URLQueryItem(name: "clinicianId", value: clinicianId))
        }
        if let npi = npi {
            queryItems.append(URLQueryItem(name: "npi", value: npi))
        }

        urlComponents.queryItems = queryItems

        guard let url = urlComponents.url else {
            throw FinancialIdentityError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FinancialIdentityError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw FinancialIdentityError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let result = try decoder.decode(FinancialIdentityResponse.self, from: data)

        guard result.ok, let identity = result.identity else {
            throw FinancialIdentityError.notFound
        }

        self.financialIdentity = identity
    }

    /// Create or update financial identity
    public func createOrUpdateFinancialIdentity(_ data: FinancialIdentityData) async throws -> String {
        isLoading = true
        error = nil

        defer { isLoading = false }

        guard let url = URL(string: "\(apiBaseURL)/api/financial/identity") else {
            throw FinancialIdentityError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(data)

        let (responseData, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FinancialIdentityError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw FinancialIdentityError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        let result = try decoder.decode(CreateFinancialIdentityResponse.self, from: responseData)

        guard result.ok else {
            throw FinancialIdentityError.serverError(500)
        }

        // Refresh identity after creation
        if let clinicianId = data.clinicianId {
            try await fetchFinancialIdentity(clinicianId: clinicianId)
        }

        return result.id
    }

    /// Link DID to financial identity
    public func linkDid(_ did: String, to financialIdentityId: String) async throws {
        guard let url = URL(string: "\(apiBaseURL)/api/financial/identity/\(financialIdentityId)/link-did") else {
            throw FinancialIdentityError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["did": did]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FinancialIdentityError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw FinancialIdentityError.serverError(httpResponse.statusCode)
        }
    }

    /// Get Medicare Reassignment (PECOS) metadata
    public func getPecosMetadata(npi: String) async throws -> PecosMetadata {
        guard let url = URL(string: "\(apiBaseURL)/api/financial/identity/pecos/\(npi)") else {
            throw FinancialIdentityError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FinancialIdentityError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw FinancialIdentityError.serverError(httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        let result = try decoder.decode(PecosMetadataResponse.self, from: data)

        guard result.ok else {
            throw FinancialIdentityError.serverError(500)
        }

        return result.metadata
    }

    /// Detect misalignments (NPI ↔ TIN mismatch)
    public func detectMisalignments() -> MisalignmentDetection? {
        guard let identity = financialIdentity,
              let misalignments = identity.misalignments else {
            return nil
        }

        return misalignments
    }
}

// MARK: - Models

public struct FinancialIdentity: Codable, Identifiable {
    public let id: String
    public let clinicianId: String
    public let npi: String?
    public let npiType2: String?
    public let tin: String?
    public let ein: String?
    public let entityType: String?
    public let practiceAddresses: [PracticeAddress]?
    public let w9Metadata: W9Metadata?
    public let linkedDid: String?
    public let pecosMetadata: PecosMetadata?
    public let misalignments: MisalignmentDetection?
    public let onChainHash: String?
    public let anchoredAt: Date?
    public let createdAt: Date
    public let updatedAt: Date
}

public struct PracticeAddress: Codable {
    public let street: String
    public let city: String
    public let state: String
    public let zip: String
    public let country: String?
}

public struct W9Metadata: Codable {
    public let signatureDate: String?
    public let version: String?
}

public struct PecosMetadata: Codable {
    public let pecosId: String?
    public let reassignmentAllowed: Bool?
    public let reassignmentPercentage: Double?
    public let lastUpdated: Date?
}

public struct MisalignmentDetection: Codable {
    public let npiTinMismatch: Bool
    public let addressMismatch: Bool
    public let details: [String]
}

public struct FinancialIdentityData: Codable {
    public let clinicianId: String
    public let npi: String?
    public let npiType2: String?
    public let tin: String?
    public let ein: String?
    public let entityType: String?
    public let practiceAddresses: [PracticeAddress]?
    public let w9Metadata: W9Metadata?
    public let linkedDid: String?
    public let pecosMetadata: PecosMetadata?
}

// MARK: - API Responses

struct FinancialIdentityResponse: Codable {
    let ok: Bool
    let identity: FinancialIdentity?
}

struct CreateFinancialIdentityResponse: Codable {
    let ok: Bool
    let id: String
    let misalignments: MisalignmentDetection?
}

struct PecosMetadataResponse: Codable {
    let ok: Bool
    let metadata: PecosMetadata
}

// MARK: - Errors

public enum FinancialIdentityError: LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(Int)
    case notFound
    case decodingError

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let code):
            return "Server error: \(code)"
        case .notFound:
            return "Financial identity not found"
        case .decodingError:
            return "Failed to decode response"
        }
    }
}

