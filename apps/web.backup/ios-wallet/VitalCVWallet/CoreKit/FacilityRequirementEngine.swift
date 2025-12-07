//
//  FacilityRequirementEngine.swift
//  VitalCVWallet
//
//  Created: Multi-Facility Credential Passport - Phase 2 - Task 9
//  Each facility has custom rules — convert them into structured requirements
//

import Foundation
import Combine

/// FacilityRequirementEngine - Parses and manages facility-specific requirements
/// Phase 2 - Tasks 9-16: Facility Requirements Parser
public class FacilityRequirementEngine: ObservableObject {
    public static let shared = FacilityRequirementEngine()

    @Published public var facilityRequirements: [String: [FacilityRequirement]] = [:] // Key: facilityId
    @Published public var crosswalkMatches: [String: [CrosswalkMatch]] = [:] // Key: facilityId
    @Published public var requirementDeltas: [String: [RequirementDelta]] = [:] // Key: facilityId
    @Published public var facilityPrivileges: [String: [FacilityPrivilege]] = [:] // Key: facilityId

    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {}

    // MARK: - Phase 2 - Task 11: Structured parsing of facility-specific PDFs / web rules

    /// Parse facility requirements from PDF or web rules
    func parseFacilityRequirements(facilityId: String, source: RequirementParseSource) -> AnyPublisher<[FacilityRequirement], APIError> {
        return networkService.parseFacilityRequirements(facilityId: facilityId, source: source)
            .map { $0.requirements }
            .receive(on: DispatchQueue.main)
            .handleEvents(receiveOutput: { [weak self] requirements in
                self?.facilityRequirements[facilityId] = requirements
            })
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 2 - Task 12: AI parser: /ai/facility/requirements

    /// Parse facility requirements using AI (handled by backend)
    func parseWithAI(facilityId: String, sourceURL: String? = nil, pdfContent: Data? = nil) -> AnyPublisher<[FacilityRequirement], APIError> {
        var source: RequirementParseSource
        if let pdf = pdfContent {
            source = RequirementParseSource(
                type: "pdf",
                url: sourceURL,
                pdfContent: pdf.base64EncodedString(),
                webRules: nil
            )
        } else if let url = sourceURL {
            source = RequirementParseSource(
                type: "web",
                url: url,
                pdfContent: nil,
                webRules: nil
            )
        } else {
            return Fail(error: APIError.invalidURL)
                .eraseToAnyPublisher()
        }

        return parseFacilityRequirements(facilityId: facilityId, source: source)
    }

    // MARK: - Phase 2 - Task 13: Crosswalk matching (clinician credential → facility requirement)

    /// Match clinician credentials to facility requirements
    func matchCredentialsToRequirements(facilityId: String, clinicianId: String) -> AnyPublisher<[CrosswalkMatch], APIError> {
        return networkService.matchCredentialsToRequirements(facilityId: facilityId, clinicianId: clinicianId)
            .map { $0.matches }
            .receive(on: DispatchQueue.main)
            .handleEvents(receiveOutput: { [weak self] matches in
                self?.crosswalkMatches[facilityId] = matches
            })
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 2 - Task 14: Delta detection ("Facility missing evidence for X")

    /// Detect missing evidence for facility requirements
    func detectRequirementDeltas(facilityId: String, clinicianId: String) -> AnyPublisher<[RequirementDelta], APIError> {
        return networkService.detectRequirementDeltas(facilityId: facilityId, clinicianId: clinicianId)
            .map { $0.deltas }
            .receive(on: DispatchQueue.main)
            .handleEvents(receiveOutput: { [weak self] deltas in
                self?.requirementDeltas[facilityId] = deltas
            })
            .eraseToAnyPublisher()
    }

    // MARK: - Phase 2 - Task 15: Facility privilege mapping ("Requires OR privileges for ICU")

    /// Get facility privileges and their requirements
    func getFacilityPrivileges(facilityId: String) -> AnyPublisher<[FacilityPrivilege], APIError> {
        return networkService.getFacilityPrivileges(facilityId: facilityId)
            .map { $0.privileges }
            .receive(on: DispatchQueue.main)
            .handleEvents(receiveOutput: { [weak self] privileges in
                self?.facilityPrivileges[facilityId] = privileges
            })
            .eraseToAnyPublisher()
    }

    /// Check if clinician is eligible for a specific privilege
    func checkPrivilegeEligibility(facilityId: String, privilegeType: PrivilegeType, credentialIds: [String]) -> Bool {
        guard let privileges = facilityPrivileges[facilityId] else {
            return false
        }

        let relevantPrivileges = privileges.filter { $0.privilegeType == privilegeType && $0.active }

        for privilege in relevantPrivileges {
            let hasAllRequired = privilege.requiredCredentials.allSatisfy { credentialIds.contains($0) }
            if hasAllRequired {
                return true
            }
        }

        return false
    }

    // MARK: - Phase 2 - Task 16: Visual badge: FacilityReady / NeedsAction / Missing

    /// Get facility readiness badge status
    func getFacilityReadinessBadge(facilityId: String, clinicianId: String) -> FacilityReadinessBadge {
        guard let deltas = requirementDeltas[facilityId] else {
            return .unknown
        }

        let criticalMissing = deltas.filter { $0.urgency == .critical && $0.status == .missing }
        let highMissing = deltas.filter { $0.urgency == .high && $0.status == .missing }

        if !criticalMissing.isEmpty || !highMissing.isEmpty {
            return .missing
        }

        let needsAction = deltas.filter { $0.status == .needsVerification || $0.status == .partial }
        if !needsAction.isEmpty {
            return .needsAction
        }

        let allComplete = deltas.allSatisfy { $0.status == .complete }
        return allComplete ? .facilityReady : .needsAction
    }

    // MARK: - Local State Management

    func getRequirements(for facilityId: String) -> [FacilityRequirement] {
        return facilityRequirements[facilityId] ?? []
    }

    func getDeltas(for facilityId: String) -> [RequirementDelta] {
        return requirementDeltas[facilityId] ?? []
    }

    func getPrivileges(for facilityId: String) -> [FacilityPrivilege] {
        return facilityPrivileges[facilityId] ?? []
    }
}

// MARK: - Facility Readiness Badge

enum FacilityReadinessBadge: String {
    case facilityReady = "Facility Ready"
    case needsAction = "Needs Action"
    case missing = "Missing"
    case unknown = "Unknown"

    var color: String {
        switch self {
        case .facilityReady:
            return "green"
        case .needsAction:
            return "yellow"
        case .missing:
            return "red"
        case .unknown:
            return "gray"
        }
    }

    var icon: String {
        switch self {
        case .facilityReady:
            return "checkmark.circle.fill"
        case .needsAction:
            return "exclamationmark.triangle.fill"
        case .missing:
            return "xmark.circle.fill"
        case .unknown:
            return "questionmark.circle.fill"
        }
    }
}

