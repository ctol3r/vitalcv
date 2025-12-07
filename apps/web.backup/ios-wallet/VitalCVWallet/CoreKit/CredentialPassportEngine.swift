//
//  CredentialPassportEngine.swift
//  VitalCVWallet
//
//  Created: Multi-Facility Credential Passport - Phase 1 - Task 1
//  The underlying graph of facilities, privileges, and identity-binding
//

import Foundation
import Combine

/// CredentialPassportEngine - Core engine for managing multi-facility credential passports
/// Phase 1 - Task 1: Create CredentialPassportEngine.swift
public class CredentialPassportEngine: ObservableObject {
    public static let shared = CredentialPassportEngine()

    @Published public var facilityPassports: [FacilityPassport] = []
    @Published public var passportPackets: [String: PassportPacket] = [:] // Key: facilityId
    @Published public var multiFacilityTrustScore: MultiFacilityTrustScore?

    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {}

    // MARK: - Phase 1 - Task 4: Backend /passport/pull and /passport/push

    /// Pull passport data from backend for a facility
    func pullPassport(facilityId: String, clinicianId: String) -> AnyPublisher<FacilityPassport, APIError> {
        return networkService.pullPassport(facilityId: facilityId, clinicianId: clinicianId)
            .map { $0.passport }
            .eraseToAnyPublisher()
    }

    /// Push passport packet to backend
    func pushPassport(facilityId: String, packet: PassportPacket) -> AnyPublisher<PassportPushResponse, APIError> {
        return networkService.pushPassport(facilityId: facilityId, packet: packet)
    }

    /// Pull all facilities for a clinician
    func pullAllFacilities(clinicianId: String) -> AnyPublisher<[FacilityPassport], APIError> {
        return networkService.pullAllFacilities(clinicianId: clinicianId)
            .map { $0.facilities }
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 1 - Task 5: DID-binding to facility identity

    /// Bind DID to facility identity
    func bindDIDToFacility(facilityId: String, did: String) -> AnyPublisher<DIDBindingResponse, APIError> {
        return networkService.bindDIDToFacility(facilityId: facilityId, did: did)
    }

    /// Get facility DID
    func getFacilityDID(facilityId: String) -> AnyPublisher<String?, APIError> {
        return networkService.getFacilityDID(facilityId: facilityId)
            .map { $0.did }
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 1 - Task 6: Chain anchor for passport issuance

    /// Anchor passport issuance to chain
    func anchorPassportIssuance(facilityId: String, passportPacket: PassportPacket) -> AnyPublisher<ChainAnchorResponse, APIError> {
        return networkService.anchorPassportIssuance(facilityId: facilityId, passportPacket: passportPacket)
    }

    // MARK: - Phase 1 - Task 7: Multi-facility trustScore aggregator

    /// Calculate aggregated trust score across all facilities
    func calculateMultiFacilityTrustScore(clinicianId: String) -> AnyPublisher<MultiFacilityTrustScore, APIError> {
        return pullAllFacilities(clinicianId: clinicianId)
            .map { facilities in
                let facilityScores = facilities.map { passport in
                    FacilityTrustScore(
                        facilityId: passport.facilityId,
                        facilityName: passport.facilityName,
                        score: passport.trustScore,
                        lastUpdated: passport.lastVerified ?? Date()
                    )
                }

                // Calculate weighted average (could be enhanced with facility weights)
                let aggregatedScore = facilityScores.isEmpty ? 0.0 :
                    facilityScores.reduce(0.0) { $0 + $1.score } / Double(facilityScores.count)

                return MultiFacilityTrustScore(
                    clinicianId: clinicianId,
                    aggregatedScore: aggregatedScore,
                    facilityScores: facilityScores,
                    calculatedAt: Date()
                )
            }
            .eraseToAnyPublisher()
    }

    /// Refresh trust scores for all facilities
    func refreshTrustScores(clinicianId: String) {
        calculateMultiFacilityTrustScore(clinicianId: clinicianId)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        print("[CredentialPassportEngine] Failed to refresh trust scores: \(error)")
                    }
                },
                receiveValue: { [weak self] trustScore in
                    self?.multiFacilityTrustScore = trustScore
                }
            )
            .store(in: &cancellables)
    }

    // MARK: - Local State Management

    func updateFacilityPassport(_ passport: FacilityPassport) {
        if let index = facilityPassports.firstIndex(where: { $0.id == passport.id }) {
            facilityPassports[index] = passport
        } else {
            facilityPassports.append(passport)
        }
    }

    func setPassportPacket(facilityId: String, packet: PassportPacket) {
        passportPackets[facilityId] = packet
    }

    func getPassportPacket(facilityId: String) -> PassportPacket? {
        return passportPackets[facilityId]
    }
}

// Note: API request/response models are defined in NetworkService.swift

