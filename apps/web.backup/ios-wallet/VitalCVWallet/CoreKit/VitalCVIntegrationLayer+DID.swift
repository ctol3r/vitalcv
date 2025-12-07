//
//  VitalCVIntegrationLayer+DID.swift
//  VitalCVWallet
//
//  Created: Batch 135-A - Tasks 6-10
//  DID integration with backend registry
//

import Foundation

// MARK: - DID Integration

extension VitalCVIntegrationLayer {

    // MARK: - Task 6: Integrate DID generation with backend DID registry

    /// Generate DID and register with backend
    public func generateAndRegisterDID(userId: String, npi: String?) async throws -> DIDRegistrationResponse {
        // Generate DID locally
        let did = try await didService.createDID()

        // Register with backend
        if let npi = npi {
            // Link NPI to DID
            return try await linkDIDToNPI(did: did, npi: npi, userId: userId)
        } else {
            // Just register DID
            return try await registerDID(did: did, userId: userId)
        }
    }

    // MARK: - Task 7: Add DID push sync to backend

    /// Push DID to backend registry (/api/did/link)
    public func linkDIDToNPI(did: String, npi: String, userId: String) async throws -> DIDRegistrationResponse {
        let request = DIDLinkRequest(npi: npi, did: did, userId: userId)

        let response: DIDLinkResponse = try await networkClient.post(
            "/api/did/link",
            body: request
        )

        // Store linked status locally
        try await didService.markDIDAsLinked(did: did, npi: npi)

        return DIDRegistrationResponse(
            did: did,
            npi: npi,
            linked: response.success,
            linkedAt: response.linkedAt
        )
    }

    /// Register DID without NPI
    private func registerDID(did: String, userId: String) async throws -> DIDRegistrationResponse {
        // Backend endpoint for DID registration
        let request = DIDRegisterRequest(did: did, userId: userId)

        let response: DIDRegistrationResponse = try await networkClient.post(
            "/api/did/register",
            body: request
        )

        return response
    }

    // MARK: - Task 8: Add DID rotation request to backend

    /// Request DID rotation from backend
    public func rotateDID(oldDID: String, userId: String) async throws -> DIDRotationResponse {
        // Generate new DID
        let newDID = try await didService.createDID()

        // Request rotation from backend
        let request = DIDRotationRequest(oldDID: oldDID, newDID: newDID, userId: userId)

        let response: DIDRotationResponse = try await networkClient.post(
            "/api/did/rotate",
            body: request
        )

        // Update local DID if rotation successful
        if response.success {
            // Store new DID as active
            _ = try await didService.createDID() // This will overwrite
        }

        return response
    }

    // MARK: - Task 9: Add issuer DID resolution via metadata endpoint

    /// Resolve issuer DID via backend metadata endpoint
    public func resolveIssuerDID(issuerDID: String) async throws -> IssuerMetadata {
        let response: IssuerMetadata = try await networkClient.get(
            "/api/issuer/metadata/\(issuerDID)"
        )
        return response
    }

    // MARK: - Task 10: Add identity conflict detection integration

    /// Check for DID conflicts with backend
    public func checkIdentityConflict(did: String) async throws -> IdentityConflictResult {
        let response: IdentityConflictCheck = try await networkClient.get(
            "/api/did/conflict-check?did=\(did)"
        )

        return IdentityConflictResult(
            hasConflict: response.hasConflict,
            conflictingDIDs: response.conflictingDIDs ?? [],
            conflictType: response.conflictType,
            resolutionSteps: response.resolutionSteps ?? []
        )
    }
}

// MARK: - DID Extension for DIDService

extension DIDService {
    /// Mark DID as linked to NPI
    func markDIDAsLinked(did: String, npi: String) async throws {
        // Store link status in keychain or local storage
        let linkKey = "did.link.\(did)"
        _ = KeychainService.shared.save(npi, key: linkKey)
    }
}

// MARK: - DID Request/Response Models

struct DIDLinkRequest: Codable {
    let npi: String
    let did: String
    let userId: String
}

struct DIDRegisterRequest: Codable {
    let did: String
    let userId: String
}

struct DIDRotationRequest: Codable {
    let oldDID: String
    let newDID: String
    let userId: String
    let reason: String?

    init(oldDID: String, newDID: String, userId: String, reason: String? = nil) {
        self.oldDID = oldDID
        self.newDID = newDID
        self.userId = userId
        self.reason = reason
    }
}

struct DIDRegistrationResponse: Codable {
    let did: String
    let npi: String?
    let linked: Bool
    let linkedAt: Date?

    init(did: String, npi: String? = nil, linked: Bool, linkedAt: Date? = nil) {
        self.did = did
        self.npi = npi
        self.linked = linked
        self.linkedAt = linkedAt
    }
}

struct DIDRotationResponse: Codable {
    let success: Bool
    let oldDID: String
    let newDID: String?
    let rotatedAt: Date?
    let message: String?
}

struct IdentityConflictCheck: Codable {
    let hasConflict: Bool
    let conflictingDIDs: [String]?
    let conflictType: String?
    let resolutionSteps: [String]?
}

struct IdentityConflictResult {
    let hasConflict: Bool
    let conflictingDIDs: [String]
    let conflictType: String?
    let resolutionSteps: [String]
}

