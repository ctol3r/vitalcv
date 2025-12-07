//
//  PassportBuilder.swift
//  VitalCVWallet
//
//  Created: Multi-Facility Credential Passport - Phase 3 - Task 17
//  Automate onboarding packet creation for ANY facility
//

import Foundation
import Combine

/// PassportBuilder - Auto-assembles credential packets for facility onboarding
/// Phase 3 - Tasks 17-24: Passport Builder & Reuse Engine
public class PassportBuilder: ObservableObject {
    public static let shared = PassportBuilder()

    @Published public var passportPackets: [String: PassportPacket] = [:] // Key: facilityId
    @Published public var readinessScores: [String: PassportReadinessScore] = [:] // Key: facilityId

    private let networkService = NetworkService.shared
    private let passportEngine = CredentialPassportEngine.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {}

    // MARK: - Phase 3 - Task 18: Auto-assemble credentials, evidence, CME, DEA, training portfolio

    /// Build passport packet for a facility (auto-assembled from clinician's credentials)
    func buildPassportPacket(facilityId: String, clinicianId: String) -> AnyPublisher<PassportPacket, APIError> {
        return networkService.buildPassportPacket(facilityId: facilityId, clinicianId: clinicianId)
            .receive(on: DispatchQueue.main)
            .handleEvents(receiveOutput: { [weak self] packet in
                self?.passportPackets[facilityId] = packet
                self?.passportEngine.setPassportPacket(facilityId: facilityId, packet: packet)
            })
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 3 - Task 19: SD-JWT selective disclosure for facility-specific requirements

    /// Create SD-JWT selective disclosure packet (hides sensitive data, reveals only required fields)
    /// Note: Backend endpoint implementation needed
    func createSelectiveDisclosurePacket(
        facilityId: String,
        clinicianId: String,
        requiredFields: [String],
        hideFields: [String] = ["birthDate", "ssn"]
    ) -> AnyPublisher<SelectiveDisclosurePacket, APIError> {
        // TODO: Add endpoint to NetworkService when backend is ready
        // This would be handled by backend with SD-JWT library
        return Fail(error: APIError.notFound)
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 3 - Task 20: BBS+ ZK-proof mode (hide DOB, reveal licensure)

    /// Create BBS+ zero-knowledge proof packet
    /// Note: Backend endpoint implementation needed
    func createZKProofPacket(
        facilityId: String,
        clinicianId: String,
        revealClaims: [String], // e.g., ["licensure", "specialty"]
        hideClaims: [String] // e.g., ["dateOfBirth", "ssn"]
    ) -> AnyPublisher<ZKProofPacket, APIError> {
        // TODO: Add endpoint to NetworkService when backend is ready
        return Fail(error: APIError.notFound)
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 3 - Task 21: "Your Passport Readiness Score" (0–100)

    /// Calculate passport readiness score (0-100)
    func calculateReadinessScore(facilityId: String, clinicianId: String) -> AnyPublisher<PassportReadinessScore, APIError> {
        return networkService.calculateReadinessScore(facilityId: facilityId, clinicianId: clinicianId)
            .receive(on: DispatchQueue.main)
            .handleEvents(receiveOutput: { [weak self] score in
                self?.readinessScores[facilityId] = score
            })
            .eraseToAnyPublisher()
    }

    /// Get cached readiness score
    func getReadinessScore(facilityId: String) -> PassportReadinessScore? {
        return readinessScores[facilityId]
    }

    // MARK: - Phase 3 - Task 22: Chain anchor event for passport submission

    /// Submit passport packet and anchor to chain
    func submitAndAnchorPassport(facilityId: String, packet: PassportPacket) -> AnyPublisher<PassportSubmissionResponse, APIError> {
        // First push the passport
        return passportEngine.pushPassport(facilityId: facilityId, packet: packet)
            .flatMap { [weak self] pushResponse -> AnyPublisher<PassportSubmissionResponse, APIError> in
                guard let self = self else {
                    return Fail(error: APIError.invalidURL)
                        .eraseToAnyPublisher()
                }

                // Then anchor it to chain
                return self.passportEngine.anchorPassportIssuance(facilityId: facilityId, passportPacket: packet)
                    .map { anchorResponse in
                        PassportSubmissionResponse(
                            passportId: pushResponse.passportId,
                            chainAnchorId: anchorResponse.anchorId,
                            txHash: anchorResponse.txHash,
                            success: true
                        )
                    }
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 3 - Task 24: Recruiter/hospital "Verify Passport" endpoint

    /// Verify passport from recruiter/hospital perspective
    func verifyPassport(facilityId: String, passportId: String, verifierId: String) -> AnyPublisher<PassportVerificationResponse, APIError> {
        return networkService.verifyPassport(facilityId: facilityId, passportId: passportId, verifierId: verifierId)
    }

    // MARK: - Local Assembly Helpers

    /// Manually assemble packet from available data (for preview before backend build)
    func assemblePacketLocally(
        clinicianId: String,
        credentials: [VerifiableCredential],
        evidence: [Evidence],
        skillLogs: [SkillLog],
        trainingPortfolio: TrainingPortfolio,
        licensure: [LicensureRecord],
        deaMate: [DEAMATERecord],
        cme: [CMERecord],
        endorsements: [Endorsement]
    ) -> PassportPacket {
        return PassportPacket(
            credentials: credentials,
            evidence: evidence,
            skillLogs: skillLogs,
            trainingPortfolio: trainingPortfolio,
            licensure: licensure,
            deaMate: deaMate,
            cme: cme,
            endorsements: endorsements,
            generatedAt: Date(),
            clinicianId: clinicianId,
            chainAnchorId: nil
        )
    }
}

// MARK: - Selective Disclosure & ZK Proof Models

struct SelectiveDisclosureRequest: Codable {
    let facilityId: String
    let clinicianId: String
    let requiredFields: [String]
    let hideFields: [String]
}

struct SelectiveDisclosurePacket: Codable {
    let packet: String // SD-JWT encoded packet
    let facilityId: String
    let revealedFields: [String]
    let hiddenFields: [String]
    let createdAt: Date
}

struct ZKProofRequest: Codable {
    let facilityId: String
    let clinicianId: String
    let revealClaims: [String]
    let hideClaims: [String]
}

struct ZKProofPacket: Codable {
    let proof: String // BBS+ ZK proof
    let facilityId: String
    let revealedClaims: [String]
    let hiddenClaims: [String]
    let createdAt: Date
}

struct PassportSubmissionResponse: Codable {
    let passportId: String
    let chainAnchorId: String?
    let txHash: String?
    let success: Bool
}

