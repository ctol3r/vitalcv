//
//  WalletCore.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 1
//  WalletCore - Unified credential state + proofs management
//

import Foundation
import Combine
import CryptoKit

/// WalletCore - Centralized credential state and proof management
/// Unifies credential storage, proof generation, and state synchronization
@MainActor
public class WalletCore: ObservableObject {
    public static let shared = WalletCore()

    // MARK: - Published State

    @Published public private(set) var credentials: [VerifiableCredential] = []
    @Published public private(set) var proofs: [String: CredentialProof] = [:] // credentialId -> proof
    @Published public private(set) var syncState: SyncState = .idle
    @Published public private(set) var lastSyncDate: Date?

    // MARK: - Private Properties

    private let persistence = WalletStatePersistence.shared
    private let sdjwtEngine = SDJWTEngine.shared
    private let bbsEngine = BBSPlusEngine.shared
    private let credProofEngine = CredProofEngine.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {
        loadState()
    }

    // MARK: - State Management

    /// Load credentials and proofs from persistent storage
    public func loadState() {
        Task {
            do {
                let storedCredentials = try await persistence.loadCredentials()
                let storedProofs = try await persistence.loadProofs()

                await MainActor.run {
                    self.credentials = storedCredentials
                    self.proofs = Dictionary(uniqueKeysWithValues: storedProofs.map { ($0.credentialId, $0) })
                }
            } catch {
                Logger.shared.logError(error, context: "WalletCore.loadState")
            }
        }
    }

    /// Save current state to persistent storage
    public func saveState() async throws {
        try await persistence.saveCredentials(credentials)
        try await persistence.saveProofs(Array(proofs.values))
    }

    // MARK: - Credential Management

    /// Add credential to wallet
    public func addCredential(_ credential: VerifiableCredential) async throws {
        // Check for duplicates
        guard !credentials.contains(where: { $0.id == credential.id }) else {
            throw WalletCoreError.duplicateCredential
        }

        credentials.append(credential)

        // Auto-generate proof if needed
        if credential.proof == nil {
            try await generateProof(for: credential.id)
        }

        try await saveState()
    }

    /// Remove credential from wallet
    public func removeCredential(_ credentialId: String) async throws {
        credentials.removeAll { $0.id == credentialId }
        proofs.removeValue(forKey: credentialId)
        try await saveState()
    }

    /// Update credential
    public func updateCredential(_ credential: VerifiableCredential) async throws {
        guard let index = credentials.firstIndex(where: { $0.id == credential.id }) else {
            throw WalletCoreError.credentialNotFound
        }

        credentials[index] = credential

        // Invalidate existing proof if credential changed
        proofs.removeValue(forKey: credential.id)

        try await saveState()
    }

    /// Get credential by ID
    public func getCredential(_ credentialId: String) -> VerifiableCredential? {
        return credentials.first { $0.id == credentialId }
    }

    // MARK: - Proof Management

    /// Generate proof for credential
    public func generateProof(for credentialId: String, proofType: ProofType = .auto) async throws {
        guard let credential = getCredential(credentialId) else {
            throw WalletCoreError.credentialNotFound
        }

        let proof: CredentialProof

        switch proofType {
        case .auto:
            // Auto-select best proof type based on credential
            proof = try await generateAutoProof(for: credential)
        case .sdjwt:
            proof = try await generateSDJWTProof(for: credential)
        case .bbsPlus:
            proof = try await generateBBSPlusProof(for: credential)
        case .jwt:
            proof = try await generateJWTProof(for: credential)
        }

        proofs[credentialId] = proof
        try await saveState()
    }

    /// Get proof for credential
    public func getProof(for credentialId: String) -> CredentialProof? {
        return proofs[credentialId]
    }

    /// Verify proof
    public func verifyProof(for credentialId: String) async throws -> Bool {
        guard let proof = getProof(for: credentialId) else {
            throw WalletCoreError.proofNotFound
        }

        guard let credential = getCredential(credentialId) else {
            throw WalletCoreError.credentialNotFound
        }

        return try await credProofEngine.verify(proof: proof, credential: credential)
    }

    // MARK: - Private Proof Generation

    private func generateAutoProof(for credential: VerifiableCredential) async throws -> CredentialProof {
        // Prefer BBS+ for selective disclosure, fallback to SD-JWT, then JWT
        if credential.credentialSubject.claims.count > 5 {
            return try await generateBBSPlusProof(for: credential)
        } else if credential.credentialSubject.claims.count > 2 {
            return try await generateSDJWTProof(for: credential)
        } else {
            return try await generateJWTProof(for: credential)
        }
    }

    private func generateSDJWTProof(for credential: VerifiableCredential) async throws -> CredentialProof {
        // Convert credential to SD-JWT format
        let claims = credential.credentialSubject.claims
        let sdjwt = try await sdjwtEngine.createSDJWT(claims: claims)

        return CredentialProof(
            credentialId: credential.id,
            type: .sdjwt,
            proofData: sdjwt,
            createdAt: Date(),
            expiresAt: credential.expirationDate
        )
    }

    private func generateBBSPlusProof(for credential: VerifiableCredential) async throws -> CredentialProof {
        let claims = credential.credentialSubject.claims
        let bbsProof = try await bbsEngine.createProof(claims: claims)

        return CredentialProof(
            credentialId: credential.id,
            type: .bbsPlus,
            proofData: bbsProof,
            createdAt: Date(),
            expiresAt: credential.expirationDate
        )
    }

    private func generateJWTProof(for credential: VerifiableCredential) async throws -> CredentialProof {
        // Simple JWT proof
        let claims = credential.credentialSubject.claims
        let jwt = try await createJWT(claims: claims)

        return CredentialProof(
            credentialId: credential.id,
            type: .jwt,
            proofData: jwt,
            createdAt: Date(),
            expiresAt: credential.expirationDate
        )
    }

    private func createJWT(claims: [String: String]) async throws -> String {
        // Simplified JWT creation (in production, use proper JWT library)
        let header = ["alg": "ES256", "typ": "JWT"]
        let payload = claims.merging(["iat": String(Int(Date().timeIntervalSince1970))]) { _, new in new }

        let headerData = try JSONSerialization.data(withJSONObject: header)
        let payloadData = try JSONSerialization.data(withJSONObject: payload)

        let headerB64 = headerData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        let payloadB64 = payloadData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        // In production, add proper signature
        return "\(headerB64).\(payloadB64).signature"
    }

    // MARK: - Synchronization

    /// Sync credentials with remote server
    public func sync() async throws {
        syncState = .syncing

        defer {
            syncState = .idle
            lastSyncDate = Date()
        }

        // Fetch remote credentials
        let remoteCredentials = try await fetchRemoteCredentials()

        // Merge with local credentials
        for remoteCred in remoteCredentials {
            if let localIndex = credentials.firstIndex(where: { $0.id == remoteCred.id }) {
                // Update if remote is newer
                if remoteCred.issuanceDate > credentials[localIndex].issuanceDate {
                    credentials[localIndex] = remoteCred
                }
            } else {
                // Add new credential
                credentials.append(remoteCred)
            }
        }

        try await saveState()
    }

    private func fetchRemoteCredentials() async throws -> [VerifiableCredential] {
        // TODO: Implement actual API call
        return []
    }
}

// MARK: - Models

public struct CredentialProof: Codable, Identifiable {
    public let id: String
    public let credentialId: String
    public let type: ProofType
    public let proofData: String
    public let createdAt: Date
    public let expiresAt: Date?

    public init(credentialId: String, type: ProofType, proofData: String, createdAt: Date, expiresAt: Date?) {
        self.id = UUID().uuidString
        self.credentialId = credentialId
        self.type = type
        self.proofData = proofData
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }
}

public enum ProofType: String, Codable {
    case sdjwt = "sd-jwt"
    case bbsPlus = "bbs+"
    case jwt = "jwt"
    case auto = "auto"
}

public enum SyncState {
    case idle
    case syncing
    case error(Error)
}

public enum WalletCoreError: LocalizedError {
    case duplicateCredential
    case credentialNotFound
    case proofNotFound
    case syncFailed

    public var errorDescription: String? {
        switch self {
        case .duplicateCredential:
            return "Credential already exists in wallet"
        case .credentialNotFound:
            return "Credential not found"
        case .proofNotFound:
            return "Proof not found for credential"
        case .syncFailed:
            return "Failed to sync credentials"
        }
    }
}

