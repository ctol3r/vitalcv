//
//  CredentialRevocationManager.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 8
//  Invalidation flow for revoked credentials
//

import Foundation
import Combine

/// CredentialRevocationManager - Manages credential revocation and invalidation
@MainActor
public class CredentialRevocationManager: ObservableObject {
    public static let shared = CredentialRevocationManager()

    // MARK: - Published Properties

    @Published public var revokedCredentials: Set<String> = []
    @Published public var revocationStatus: [String: RevocationStatus] = [:]
    @Published public var lastCheckDate: Date?

    // MARK: - Private Properties

    private let walletCore = WalletCore.shared
    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()
    private var checkTimer: Timer?

    // MARK: - Configuration

    /// Check interval in seconds (default: 300 seconds = 5 minutes)
    public var checkInterval: TimeInterval = 300

    /// Enable automatic revocation checking
    public var autoCheckEnabled: Bool = true

    // MARK: - Initialization

    private init() {
        if autoCheckEnabled {
            startAutoCheck()
        }
    }

    // MARK: - Revocation Checking

    /// Check revocation status for a credential
    public func checkRevocationStatus(_ credentialId: String) async throws -> RevocationStatus {
        let endpoint = "/api/credentials/\(credentialId)/revocation-status"

        return try await withCheckedThrowingContinuation { continuation in
            guard let url = URL(string: networkService.baseURL + endpoint) else {
                continuation.resume(throwing: CredentialRevocationError.invalidURL)
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            // Add DPoP signing
            if networkService.enableDPoPSigning {
                do {
                    let dpopToken = try DPoPSigner.shared.generateDPoPToken(
                        method: "GET",
                        url: url,
                        accessToken: networkService.accessToken
                    )
                    request.setValue(dpopToken, forHTTPHeaderField: "DPoP")
                } catch {
                    print("⚠️ Failed to generate DPoP token: \(error.localizedDescription)")
                }
            }

            if let token = networkService.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode),
                      let data = data else {
                    continuation.resume(throwing: CredentialRevocationError.invalidResponse)
                    return
                }

                do {
                    let status = try JSONDecoder().decode(RevocationStatus.self, from: data)
                    continuation.resume(returning: status)
                } catch {
                    continuation.resume(throwing: CredentialRevocationError.decodingError(error))
                }
            }.resume()
        }
    }

    /// Check revocation status for all credentials
    public func checkAllRevocationStatus() async throws {
        let credentialIds = walletCore.credentials.map { $0.id }

        for credentialId in credentialIds {
            do {
                let status = try await checkRevocationStatus(credentialId)
                revocationStatus[credentialId] = status

                // Invalidate if revoked
                if status.isRevoked {
                    await invalidateCredential(credentialId, reason: status.revocationReason)
                }
            } catch {
                print("⚠️ Failed to check revocation status for \(credentialId): \(error.localizedDescription)")
            }
        }

        lastCheckDate = Date()
    }

    /// Invalidate a credential
    public func invalidateCredential(_ credentialId: String, reason: String? = nil) async {
        // Add to revoked set
        revokedCredentials.insert(credentialId)

        // Update revocation status
        if revocationStatus[credentialId] == nil {
            revocationStatus[credentialId] = RevocationStatus(
                credentialId: credentialId,
                isRevoked: true,
                revokedAt: Date(),
                revocationReason: reason
            )
        } else {
            var status = revocationStatus[credentialId]!
            status.isRevoked = true
            status.revokedAt = Date()
            status.revocationReason = reason
            revocationStatus[credentialId] = status
        }

        // Remove from wallet or mark as invalid
        // Option 1: Remove completely
        // try? await walletCore.removeCredential(credentialId)

        // Option 2: Keep but mark as invalid (preferred for audit trail)
        // This would require updating the credential model

        // Post notification
        NotificationCenter.default.post(
            name: .credentialRevoked,
            object: nil,
            userInfo: ["credentialId": credentialId, "reason": reason ?? ""]
        )
    }

    /// Check if credential is revoked
    public func isRevoked(_ credentialId: String) -> Bool {
        return revokedCredentials.contains(credentialId) ||
               revocationStatus[credentialId]?.isRevoked == true
    }

    /// Get revocation status for credential
    public func getRevocationStatus(_ credentialId: String) -> RevocationStatus? {
        return revocationStatus[credentialId]
    }

    // MARK: - Auto Check

    private func startAutoCheck() {
        checkTimer = Timer.scheduledTimer(withTimeInterval: checkInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                try? await self?.checkAllRevocationStatus()
            }
        }
    }

    public func stopAutoCheck() {
        checkTimer?.invalidate()
        checkTimer = nil
    }
}

// MARK: - Supporting Types

public struct RevocationStatus: Codable {
    public let credentialId: String
    public var isRevoked: Bool
    public var revokedAt: Date?
    public var revocationReason: String?
    public var revocationDate: Date?

    public init(credentialId: String, isRevoked: Bool, revokedAt: Date? = nil, revocationReason: String? = nil, revocationDate: Date? = nil) {
        self.credentialId = credentialId
        self.isRevoked = isRevoked
        self.revokedAt = revokedAt
        self.revocationReason = revocationReason
        self.revocationDate = revocationDate
    }
}

public enum CredentialRevocationError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case decodingError(Error)
    case credentialNotFound

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL for revocation check"
        case .invalidResponse:
            return "Invalid response from server"
        case .decodingError(let error):
            return "Failed to decode revocation status: \(error.localizedDescription)"
        case .credentialNotFound:
            return "Credential not found"
        }
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let credentialRevoked = Notification.Name("credentialRevoked")
}








