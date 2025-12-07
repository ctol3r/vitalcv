//
//  NetworkService.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 3
//  Updated: Batch 136-A - Task 2 (request-signing interceptor)
//  Network service using Combine for reactive flows with DPoP signing
//

import Foundation
import Combine
import UIKit

class NetworkService {
    static let shared = NetworkService()

    private let baseURL: String
    private let session: URLSession
    private var cancellables = Set<AnyCancellable>()

    /// Enable/disable DPoP signing for requests
    public var enableDPoPSigning: Bool = true

    /// Optional access token for DPoP binding
    public var accessToken: String?

    init(baseURL: String? = nil) {
        self.baseURL = baseURL ?? (ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:4000")
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }

    // MARK: - Credentials API

    func issueCredential(request: CredentialIssueRequest) -> AnyPublisher<VerifiableCredential, APIError> {
        return request(endpoint: "/api/credentials/issue", method: "POST", body: request)
    }

    func verifyCredential(credentialId: String) -> AnyPublisher<VerificationResult, APIError> {
        return request(endpoint: "/api/verify", method: "POST", body: ["credentialId": credentialId])
    }

    // MARK: - DID API

    func linkDID(npi: String, did: String, userId: String) -> AnyPublisher<DIDLinkResponse, APIError> {
        let body = ["npi": npi, "did": did, "userId": userId]
        return request(endpoint: "/api/did/link", method: "POST", body: body)
    }

    // MARK: - NPI API

    func lookupNPI(_ npi: String) -> AnyPublisher<NPIResponse, APIError> {
        return request(endpoint: "/api/npi/lookup?npi=\(npi)", method: "GET")
    }

    // MARK: - Routing API

    func getRoutingRecommendations(userId: String) -> AnyPublisher<[RoutingRecommendation], APIError> {
        return request(endpoint: "/api/routing/recommend?userId=\(userId)", method: "GET")
    }

    // MARK: - Scheduler API

    func fetchShifts() -> AnyPublisher<[Shift], APIError> {
        return request(endpoint: "/api/scheduler/shifts", method: "GET")
    }

    func fetchProviders() -> AnyPublisher<[Provider], APIError> {
        return request(endpoint: "/api/scheduler/providers", method: "GET")
    }

    func assignProviderToShift(shiftId: String, providerId: String) -> AnyPublisher<Shift, APIError> {
        let body = ["shiftId": shiftId, "providerId": providerId]
        return request(endpoint: "/api/scheduler/shifts/\(shiftId)/assign", method: "POST", body: body)
    }

    func unassignProviderFromShift(shiftId: String, providerId: String) -> AnyPublisher<Shift, APIError> {
        return request(endpoint: "/api/scheduler/shifts/\(shiftId)/unassign/\(providerId)", method: "DELETE")
    }

    func getProviderEligibility(shiftId: String, providerId: String) -> AnyPublisher<ProviderEligibility, APIError> {
        return request(endpoint: "/api/scheduler/shifts/\(shiftId)/eligibility/\(providerId)", method: "GET")
    }

    func getCoverageAnalysis(startDate: Date, endDate: Date) -> AnyPublisher<CoverageAnalysis, APIError> {
        let formatter = ISO8601DateFormatter()
        let start = formatter.string(from: startDate)
        let end = formatter.string(from: endDate)
        return request(endpoint: "/api/scheduler/coverage?startDate=\(start)&endDate=\(end)", method: "GET")
    }

    // MARK: - AI Assistant API

    func fetchAIContext(did: String) -> AnyPublisher<AIAssistantContext, APIError> {
        return request(endpoint: "/api/ai/assistant/context?did=\(did)", method: "GET")
    }

    func queryAIAssistant(
        query: AIAssistantQuery,
        prompt: String,
        context: AIAssistantContext?
    ) async throws -> AIAssistantResponse {
        let requestBody = AIAssistantQueryRequest(
            query: query,
            prompt: prompt,
            context: context
        )

        return try await withCheckedThrowingContinuation { continuation in
            var cancellable: AnyCancellable?
            cancellable = self.request(endpoint: "/api/ai/assistant/query", method: "POST", body: requestBody)
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            continuation.resume(throwing: error)
                        }
                        cancellable?.cancel()
                    },
                    receiveValue: { response in
                        continuation.resume(returning: response)
                        cancellable?.cancel()
                    }
                )
            if let cancellable = cancellable {
                self.cancellables.insert(cancellable)
            }
        }
    }

    func fetchAIContextAsync(did: String) async throws -> AIAssistantContext {
        return try await withCheckedThrowingContinuation { continuation in
            var cancellable: AnyCancellable?
            cancellable = self.fetchAIContext(did: did)
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            continuation.resume(throwing: error)
                        }
                        cancellable?.cancel()
                    },
                    receiveValue: { response in
                        continuation.resume(returning: response)
                        cancellable?.cancel()
                    }
                )
            if let cancellable = cancellable {
                self.cancellables.insert(cancellable)
            }
        }
    }

    // MARK: - CME API

    func fetchCMERequirements() -> AnyPublisher<CMERequirementsResponse, APIError> {
        return request(endpoint: "/api/cme/requirements", method: "GET")
    }

    func fetchCMECredits() -> AnyPublisher<CMECreditsResponse, APIError> {
        return request(endpoint: "/api/cme/credits", method: "GET")
    }

    func addCMECredit(request: AddCMECreditRequest) -> AnyPublisher<AddCMECreditResponse, APIError> {
        return request(endpoint: "/api/cme/add", method: "POST", body: request)
    }

    func parseCMERequirements(request: CMERequirementParseRequest) -> AnyPublisher<CMERequirementParseResponse, APIError> {
        return request(endpoint: "/api/cme/parse-requirements", method: "POST", body: request)
    }

    // MARK: - Passport API
    // Phase 1 - Task 4: Backend /passport/pull + /passport/push

    func pullPassport(facilityId: String, clinicianId: String) -> AnyPublisher<PassportPullResponse, APIError> {
        return request(
            endpoint: "/api/passport/pull",
            method: "GET",
            queryParams: ["facilityId": facilityId, "clinicianId": clinicianId]
        )
    }

    func pushPassport(facilityId: String, packet: PassportPacket) -> AnyPublisher<PassportPushResponse, APIError> {
        let request = PassportPushRequest(facilityId: facilityId, packet: packet)
        return request(endpoint: "/api/passport/push", method: "POST", body: request)
    }

    func pullAllFacilities(clinicianId: String) -> AnyPublisher<FacilitiesResponse, APIError> {
        return request(
            endpoint: "/api/passport/facilities",
            method: "GET",
            queryParams: ["clinicianId": clinicianId]
        )
    }

    func bindDIDToFacility(facilityId: String, did: String) -> AnyPublisher<DIDBindingResponse, APIError> {
        let request = DIDBindingRequest(facilityId: facilityId, did: did)
        return request(endpoint: "/api/passport/facility/did/bind", method: "POST", body: request)
    }

    func getFacilityDID(facilityId: String) -> AnyPublisher<FacilityDIDResponse, APIError> {
        return request(endpoint: "/api/passport/facility/\(facilityId)/did", method: "GET")
    }

    func anchorPassportIssuance(facilityId: String, passportPacket: PassportPacket) -> AnyPublisher<ChainAnchorResponse, APIError> {
        let request = PassportAnchorRequest(facilityId: facilityId, passportPacket: passportPacket, version: "VitalCV Passport v1")
        return request(endpoint: "/api/passport/anchor", method: "POST", body: request)
    }

    // MARK: - Facility Requirements API
    // Phase 2 - Tasks 9-16

    func parseFacilityRequirements(facilityId: String, source: RequirementParseSource) -> AnyPublisher<FacilityRequirementsResponse, APIError> {
        let request = FacilityRequirementsParseRequest(facilityId: facilityId, source: source)
        return request(endpoint: "/api/ai/facility/requirements", method: "POST", body: request)
    }

    func matchCredentialsToRequirements(facilityId: String, clinicianId: String) -> AnyPublisher<CrosswalkMatchResponse, APIError> {
        return request(
            endpoint: "/api/passport/facility/\(facilityId)/crosswalk",
            method: "GET",
            queryParams: ["clinicianId": clinicianId]
        )
    }

    func detectRequirementDeltas(facilityId: String, clinicianId: String) -> AnyPublisher<RequirementDeltasResponse, APIError> {
        return request(
            endpoint: "/api/passport/facility/\(facilityId)/deltas",
            method: "GET",
            queryParams: ["clinicianId": clinicianId]
        )
    }

    func getFacilityPrivileges(facilityId: String) -> AnyPublisher<FacilityPrivilegesResponse, APIError> {
        return request(endpoint: "/api/passport/facility/\(facilityId)/privileges", method: "GET")
    }

    // MARK: - Passport Builder API
    // Phase 3 - Tasks 17-24

    func buildPassportPacket(facilityId: String, clinicianId: String) -> AnyPublisher<PassportPacket, APIError> {
        return request(
            endpoint: "/api/passport/build",
            method: "POST",
            body: PassportBuildRequest(facilityId: facilityId, clinicianId: clinicianId)
        )
    }

    func calculateReadinessScore(facilityId: String, clinicianId: String) -> AnyPublisher<PassportReadinessScore, APIError> {
        return request(
            endpoint: "/api/passport/readiness",
            method: "GET",
            queryParams: ["facilityId": facilityId, "clinicianId": clinicianId]
        )
    }

    func verifyPassport(facilityId: String, passportId: String, verifierId: String) -> AnyPublisher<PassportVerificationResponse, APIError> {
        let request = PassportVerificationRequest(passportId: passportId, verifierId: verifierId)
        return request(endpoint: "/api/passport/facility/\(facilityId)/verify", method: "POST", body: request)
    }

    // MARK: - Facility Onboarding API
    // Phase 4 - Tasks 25-32

    func getFacilityOnboardingStatus(facilityId: String, clinicianId: String) -> AnyPublisher<FacilityOnboardingStatus, APIError> {
        return request(
            endpoint: "/api/passport/onboarding/\(facilityId)",
            method: "GET",
            queryParams: ["clinicianId": clinicianId]
        )
    }

    func uploadOnboardingEvidence(facilityId: String, requirementId: String, evidence: Data, fileName: String) -> AnyPublisher<EvidenceUploadResponse, APIError> {
        // This would typically use multipart form data
        let request = EvidenceUploadRequest(requirementId: requirementId, fileName: fileName, data: evidence.base64EncodedString())
        return request(endpoint: "/api/passport/onboarding/\(facilityId)/evidence", method: "POST", body: request)
    }

    func searchFacilities(query: String) -> AnyPublisher<FacilitySearchResponse, APIError> {
        return request(
            endpoint: "/api/passport/facilities/search",
            method: "GET",
            queryParams: ["query": query]
        )
    }

    func connectToFacility(facilityId: String, clinicianId: String) -> AnyPublisher<FacilityConnectionResponse, APIError> {
        let request = FacilityConnectionRequest(facilityId: facilityId, clinicianId: clinicianId)
        return request(endpoint: "/api/passport/facilities/connect", method: "POST", body: request)
    }

    // MARK: - Recruiter & Scheduling Integration API
    // Phase 5 - Tasks 33-40

    func getMultiFacilityCandidateStatus(clinicianId: String) -> AnyPublisher<MultiFacilityCandidateResponse, APIError> {
        return request(
            endpoint: "/api/passport/recruiter/candidate/\(clinicianId)",
            method: "GET"
        )
    }

    func predictOnboardingTime(facilityId: String, clinicianId: String) -> AnyPublisher<OnboardingTimePrediction, APIError> {
        return request(
            endpoint: "/api/passport/onboarding/\(facilityId)/predict",
            method: "GET",
            queryParams: ["clinicianId": clinicianId]
        )
    }

    func getFacilityCredentialSnapshot(facilityId: String, clinicianId: String) -> AnyPublisher<FacilityCredentialSnapshot, APIError> {
        return request(
            endpoint: "/api/passport/facility/\(facilityId)/snapshot",
            method: "GET",
            queryParams: ["clinicianId": clinicianId]
        )
    }

    func generateNCQAPacket(facilityId: String, clinicianId: String) -> AnyPublisher<NCQAPacketResponse, APIError> {
        return request(
            endpoint: "/api/passport/facility/\(facilityId)/ncqa",
            method: "POST",
            body: NCQAPacketRequest(clinicianId: clinicianId)
        )
    }

    // MARK: - Generic Request

    private func request<T: Decodable, U: Encodable>(
        endpoint: String,
        method: String,
        body: U? = nil
    ) -> AnyPublisher<T, APIError> {
        guard let url = URL(string: baseURL + endpoint) else {
            return Fail(error: APIError.invalidURL)
                .eraseToAnyPublisher()
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body = body {
            do {
                request.httpBody = try JSONEncoder().encode(body)
            } catch {
                return Fail(error: APIError.encodingError(error))
                    .eraseToAnyPublisher()
            }
        }

        // Add DPoP signing interceptor (Batch 136-A - Task 2)
        if enableDPoPSigning {
            do {
                let dpopToken = try DPoPSigner.shared.generateDPoPToken(
                    method: method,
                    url: url,
                    accessToken: accessToken
                )
                request.setValue(dpopToken, forHTTPHeaderField: "DPoP")
            } catch {
                // Log error but don't fail the request
                print("⚠️ Failed to generate DPoP token: \(error.localizedDescription)")
            }
        }

        // Add access token if available
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return session.dataTaskPublisher(for: request)
            .tryMap { data, response -> Data in
                // Check for HTTP errors
                if let httpResponse = response as? HTTPURLResponse {
                    switch httpResponse.statusCode {
                    case 200...299:
                        return data
                    case 401:
                        throw APIError.unauthorized
                    case 404:
                        throw APIError.notFound
                    default:
                        let message = String(data: data, encoding: .utf8)
                        throw APIError.serverError(httpResponse.statusCode, message)
                    }
                }
                return data
            }
            .decode(type: T.self, decoder: JSONDecoder())
            .mapError { error -> APIError in
                if let apiError = error as? APIError {
                    return apiError
                }
                if error is DecodingError {
                    return APIError.decodingError(error)
                }
                return APIError.networkError(error)
            }
            .eraseToAnyPublisher()
    }

    private func request<T: Decodable>(
        endpoint: String,
        method: String
    ) -> AnyPublisher<T, APIError> {
        return request(endpoint: endpoint, method: method, body: Optional<[String: String]>.none)
    }

    private func request<T: Decodable>(
        endpoint: String,
        method: String,
        queryParams: [String: String]?
    ) -> AnyPublisher<T, APIError> {
        var urlString = baseURL + endpoint
        if let params = queryParams, !params.isEmpty {
            var components = URLComponents(string: urlString)
            components?.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
            if let url = components?.url {
                urlString = url.absoluteString
            }
        }

        guard let url = URL(string: urlString) else {
            return Fail(error: APIError.invalidURL)
                .eraseToAnyPublisher()
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if enableDPoPSigning {
            do {
                let dpopToken = try DPoPSigner.shared.generateDPoPToken(
                    method: method,
                    url: url,
                    accessToken: accessToken
                )
                request.setValue(dpopToken, forHTTPHeaderField: "DPoP")
            } catch {
                print("⚠️ Failed to generate DPoP token: \(error.localizedDescription)")
            }
        }

        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return session.dataTaskPublisher(for: request)
            .tryMap { data, response -> Data in
                if let httpResponse = response as? HTTPURLResponse {
                    switch httpResponse.statusCode {
                    case 200...299:
                        return data
                    case 401:
                        throw APIError.unauthorized
                    case 404:
                        throw APIError.notFound
                    default:
                        let message = String(data: data, encoding: .utf8)
                        throw APIError.serverError(httpResponse.statusCode, message)
                    }
                }
                return data
            }
            .decode(type: T.self, decoder: JSONDecoder())
            .mapError { error -> APIError in
                if let apiError = error as? APIError {
                    return apiError
                }
                if error is DecodingError {
                    return APIError.decodingError(error)
                }
                return APIError.networkError(error)
            }
            .eraseToAnyPublisher()
    }
}

// MARK: - API Models

struct CredentialIssueRequest: Codable {
    let templateId: String
    let claims: [String: String]
    let holderDid: String
}

struct DIDLinkResponse: Codable {
    let success: Bool
    let npi: String
    let did: String
    let linkedAt: Date
}

struct NPIResponse: Codable {
    let npi: String
    let type: String
    let name: String
    let taxonomy: [String]
    let verified: Bool
    let provider: NPIProvider?
}

struct NPIProvider: Codable {
    let address: String?
    let phone: String?
    let email: String?
}

struct RoutingRecommendation: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let priority: Int
    let actionUrl: String?
}

// MARK: - AI Assistant API Models

struct AIAssistantQueryRequest: Codable {
    let query: AIAssistantQuery
    let prompt: String
    let context: AIAssistantContext?
}

// MARK: - CME API Models

struct CMERequirementsResponse: Codable {
    let requirements: [CMERequirement]
}

struct CMECreditsResponse: Codable {
    let credits: [CMECreditEntry]
}

struct AddCMECreditRequest: Codable {
    let credit: CMECreditEntry
}

struct AddCMECreditResponse: Codable {
    let credit: CMECreditEntry
    let success: Bool
}

struct CMERequirementParseRequest: Codable {
    let state: String
    let specialty: String?
}

struct CMERequirementParseResponse: Codable {
    let requirement: CMERequirement
}

// MARK: - Passport API Models

struct PassportPullResponse: Codable {
    let passport: FacilityPassport
}

struct PassportPushRequest: Codable {
    let facilityId: String
    let packet: PassportPacket
}

struct PassportPushResponse: Codable {
    let success: Bool
    let passportId: String
    let chainAnchorId: String?
    let message: String?
}

struct FacilitiesResponse: Codable {
    let facilities: [FacilityPassport]
}

struct DIDBindingRequest: Codable {
    let facilityId: String
    let did: String
}

struct DIDBindingResponse: Codable {
    let success: Bool
    let facilityId: String
    let did: String
    let message: String?
}

struct FacilityDIDResponse: Codable {
    let facilityId: String
    let did: String?
}

struct PassportAnchorRequest: Codable {
    let facilityId: String
    let passportPacket: PassportPacket
    let version: String
}

struct ChainAnchorResponse: Codable {
    let success: Bool
    let anchorId: String
    let txHash: String?
    let network: String?
    let timestamp: Date
}

// MARK: - Facility Requirements API Models

struct RequirementParseSource: Codable {
    let type: String // "pdf", "web", "manual"
    let url: String?
    let pdfContent: String? // base64 encoded
    let webRules: String?
}

struct FacilityRequirementsParseRequest: Codable {
    let facilityId: String
    let source: RequirementParseSource
}

struct FacilityRequirementsResponse: Codable {
    let requirements: [FacilityRequirement]
    let parsedAt: Date
}

struct CrosswalkMatchResponse: Codable {
    let matches: [CrosswalkMatch]
    let facilityId: String
    let clinicianId: String
}

struct RequirementDeltasResponse: Codable {
    let deltas: [RequirementDelta]
    let facilityId: String
    let clinicianId: String
}

struct FacilityPrivilegesResponse: Codable {
    let privileges: [FacilityPrivilege]
    let facilityId: String
}

// MARK: - Passport Builder API Models

struct PassportBuildRequest: Codable {
    let facilityId: String
    let clinicianId: String
}

struct PassportVerificationRequest: Codable {
    let passportId: String
    let verifierId: String
}

struct PassportVerificationResponse: Codable {
    let verified: Bool
    let passportId: String
    let verifierId: String
    let verifiedAt: Date
    let notes: String?
}

// MARK: - Facility Onboarding API Models

struct EvidenceUploadRequest: Codable {
    let requirementId: String
    let fileName: String
    let data: String // base64 encoded
}

struct EvidenceUploadResponse: Codable {
    let success: Bool
    let evidenceId: String
    let requirementId: String
    let uploadedAt: Date
}

struct FacilitySearchResponse: Codable {
    let facilities: [FacilitySearchResult]
}

struct FacilitySearchResult: Codable, Identifiable {
    let id: String
    let facilityId: String
    let name: String
    let location: String?
    let trustScore: Double?
}

struct FacilityConnectionRequest: Codable {
    let facilityId: String
    let clinicianId: String
}

struct FacilityConnectionResponse: Codable {
    let success: Bool
    let onboardingStatusId: String
    let facilityId: String
    let startedAt: Date
}

// MARK: - Recruiter & Scheduling API Models

struct MultiFacilityCandidateResponse: Codable {
    let clinicianId: String
    let candidateName: String
    let onboardingReadyFacilities: [OnboardingReadyFacility]
    let totalFacilities: Int
}

struct OnboardingReadyFacility: Codable, Identifiable {
    let id: String
    let facilityId: String
    let facilityName: String
    let readinessScore: Double
    let status: OnboardingPhase
}

struct OnboardingTimePrediction: Codable {
    let facilityId: String
    let clinicianId: String
    let predictedDays: Int
    let confidence: Double
    let factors: [String]
    let calculatedAt: Date
}

struct FacilityCredentialSnapshot: Codable {
    let facilityId: String
    let clinicianId: String
    let snapshot: [String: AnyCodable]
    let generatedAt: Date
}

struct NCQAPacketRequest: Codable {
    let clinicianId: String
}

struct NCQAPacketResponse: Codable {
    let success: Bool
    let packetId: String
    let downloadUrl: String?
    let generatedAt: Date
}

// Helper for AnyCodable if needed
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable value cannot be decoded")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "AnyCodable value cannot be encoded"))
        }
    }
}

// MARK: - API Error

enum APIError: Error, LocalizedError {
    case invalidURL
    case networkError(Error)
    case decodingError(Error)
    case encodingError(Error)
    case serverError(Int, String?)
    case unauthorized
    case notFound

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .encodingError(let error):
            return "Encoding error: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Server error \(code): \(message ?? "Unknown error")"
        case .unauthorized:
            return "Unauthorized"
        case .notFound:
            return "Not found"
        }
    }
}

