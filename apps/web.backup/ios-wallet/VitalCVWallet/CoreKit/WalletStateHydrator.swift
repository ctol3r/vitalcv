//
//  WalletStateHydrator.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 6
//  WalletState hydrator from backend
//

import Foundation
import Combine

/// WalletStateHydrator - Hydrates wallet state from backend API
@MainActor
public class WalletStateHydrator: ObservableObject {
    public static let shared = WalletStateHydrator()

    // MARK: - Published Properties

    @Published public var isHydrating: Bool = false
    @Published public var lastHydrationDate: Date?
    @Published public var hydrationError: Error?

    // MARK: - Private Properties

    private let networkService = NetworkService.shared
    private let walletCore = WalletCore.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {}

    // MARK: - Hydration

    /// Hydrate wallet state from backend
    public func hydrate() async throws {
        isHydrating = true
        hydrationError = nil

        defer {
            isHydrating = false
        }

        do {
            // Fetch wallet state from backend
            let walletState = try await fetchWalletState()

            // Merge with local state
            try await mergeWalletState(walletState)

            lastHydrationDate = Date()
        } catch {
            hydrationError = error
            throw error
        }
    }

    /// Fetch wallet state from backend
    private func fetchWalletState() async throws -> BackendWalletState {
        // Use NetworkService to fetch wallet state
        // This would typically be: GET /api/wallet/state
        let endpoint = "/api/wallet/state"

        // For now, create a publisher-based approach
        return try await withCheckedThrowingContinuation { continuation in
            // Create a generic request
            guard let url = URL(string: networkService.baseURL + endpoint) else {
                continuation.resume(throwing: WalletStateHydratorError.invalidURL)
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // Add DPoP signing if enabled
            if networkService.enableDPoPSigning {
                do {
                    let dpopToken = try DPoPSigner.shared.generateDPoPToken(
                        method: "GET",
                        url: url,
                        accessToken: networkService.accessToken
                    )
                    request.setValue(dpopToken, forHTTPHeaderField: "DPoP")
                } catch {
                    // Log but continue
                    print("⚠️ Failed to generate DPoP token: \(error.localizedDescription)")
                }
            }

            // Add access token if available
            if let token = networkService.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    continuation.resume(throwing: WalletStateHydratorError.invalidResponse)
                    return
                }

                guard (200...299).contains(httpResponse.statusCode) else {
                    continuation.resume(throwing: WalletStateHydratorError.serverError(httpResponse.statusCode))
                    return
                }

                guard let data = data else {
                    continuation.resume(throwing: WalletStateHydratorError.noData)
                    return
                }

                do {
                    let walletState = try JSONDecoder().decode(BackendWalletState.self, from: data)
                    continuation.resume(returning: walletState)
                } catch {
                    continuation.resume(throwing: WalletStateHydratorError.decodingError(error))
                }
            }.resume()
        }
    }

    /// Merge backend wallet state with local state
    private func mergeWalletState(_ backendState: BackendWalletState) async throws {
        // Update credentials
        for backendCredential in backendState.credentials {
            // Check if credential exists locally
            if let existing = walletCore.getCredential(backendCredential.id) {
                // Update if backend version is newer
                if let backendUpdated = backendState.credentialMetadata[backendCredential.id]?.lastUpdated,
                   let localUpdated = existing.issuedAt,
                   backendUpdated > localUpdated {
                    try await walletCore.updateCredential(backendCredential)
                }
            } else {
                // Add new credential
                try await walletCore.addCredential(backendCredential)
            }
        }

        // Remove credentials that are no longer in backend (if configured)
        // This is optional and depends on sync strategy
    }

    /// Auto-hydrate on interval
    public func startAutoHydration(interval: TimeInterval = 300) {
        Timer.publish(every: interval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task { @MainActor in
                    try? await self?.hydrate()
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Supporting Types

public struct BackendWalletState: Codable {
    public let credentials: [VerifiableCredential]
    public let credentialMetadata: [String: CredentialMetadata]
    public let lastSyncDate: Date?

    public init(credentials: [VerifiableCredential], credentialMetadata: [String: CredentialMetadata], lastSyncDate: Date?) {
        self.credentials = credentials
        self.credentialMetadata = credentialMetadata
        self.lastSyncDate = lastSyncDate
    }
}

public struct CredentialMetadata: Codable {
    public let lastUpdated: Date?
    public let status: CredentialStatus
    public let revocationDate: Date?
    public let chainAnchorStatus: String?

    public init(lastUpdated: Date?, status: CredentialStatus, revocationDate: Date?, chainAnchorStatus: String?) {
        self.lastUpdated = lastUpdated
        self.status = status
        self.revocationDate = revocationDate
        self.chainAnchorStatus = chainAnchorStatus
    }
}

public enum CredentialStatus: String, Codable {
    case active
    case revoked
    case expired
    case suspended
}

public enum WalletStateHydratorError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(Int)
    case noData
    case decodingError(Error)

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL for wallet state hydration"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let code):
            return "Server error: \(code)"
        case .noData:
            return "No data received from server"
        case .decodingError(let error):
            return "Failed to decode wallet state: \(error.localizedDescription)"
        }
    }
}

// MARK: - NetworkService Extension

extension NetworkService {
    var baseURL: String {
        // Access baseURL - we'll need to make it accessible
        // For now, use a workaround
        return ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:4000"
    }
}








