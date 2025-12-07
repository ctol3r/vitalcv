//
//  CandidateStore.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 15
//  CandidateStore: Recruiter mode candidate storage
//

import Foundation

/// CandidateStore - Stores candidate information for recruiter mode
/// Manages candidate profiles, verification results, and trust scores
@MainActor
class CandidateStore: ObservableObject {
    static let shared = CandidateStore()

    @Published private(set) var candidates: [Candidate] = []

    private let fileManager = FileManager.default
    private let candidatesDirectory: URL
    private let keychain = KeychainService.shared

    private init() {
        // Setup candidates directory
        let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        candidatesDirectory = documentsURL.appendingPathComponent("Candidates", isDirectory: true)

        // Create directory if needed
        if !fileManager.fileExists(atPath: candidatesDirectory.path) {
            try? fileManager.createDirectory(at: candidatesDirectory, withIntermediateDirectories: true)
        }

        // Load candidates on init
        Task {
            await loadCandidates()
        }
    }

    // MARK: - Public API

    /// Add or update candidate
    func saveCandidate(_ candidate: Candidate) async throws {
        // Add or update in memory
        if let index = candidates.firstIndex(where: { $0.id == candidate.id }) {
            candidates[index] = candidate
        } else {
            candidates.append(candidate)
        }

        // Persist to disk
        try await persistCandidate(candidate)
    }

    /// Get candidate by ID
    func getCandidate(id: String) -> Candidate? {
        return candidates.first { $0.id == id }
    }

    /// Get all candidates
    func getAllCandidates() -> [Candidate] {
        return candidates
    }

    /// Get candidates matching filter
    func getCandidates(filter: CandidateFilter) -> [Candidate] {
        var filtered = candidates

        // Filter by trust score
        if let minTrustScore = filter.minTrustScore {
            filtered = filtered.filter { $0.trustScore >= minTrustScore }
        }

        // Filter by status
        if let status = filter.status {
            filtered = filtered.filter { $0.status == status }
        }

        // Filter by search query
        if let query = filter.searchQuery, !query.isEmpty {
            filtered = filtered.filter { candidate in
                candidate.name.localizedCaseInsensitiveContains(query) ||
                candidate.email?.localizedCaseInsensitiveContains(query) == true ||
                candidate.credentials.contains { $0.type.localizedCaseInsensitiveContains(query) }
            }
        }

        // Sort
        switch filter.sortBy {
        case .trustScore:
            filtered.sort { $0.trustScore > $1.trustScore }
        case .name:
            filtered.sort { $0.name < $1.name }
        case .dateAdded:
            filtered.sort { ($0.addedAt ?? Date()) > ($1.addedAt ?? Date()) }
        }

        return filtered
    }

    /// Delete candidate
    func deleteCandidate(_ candidateId: String) async throws {
        candidates.removeAll { $0.id == candidateId }
        try await removeCandidateFromDisk(candidateId)
    }

    /// Update candidate status
    func updateCandidateStatus(_ candidateId: String, status: CandidateStatus) async throws {
        guard var candidate = getCandidate(id: candidateId) else {
            throw CandidateStoreError.notFound
        }

        candidate.status = status
        try await saveCandidate(candidate)
    }

    /// Add verification result to candidate
    func addVerificationResult(_ candidateId: String, result: VerificationResult) async throws {
        guard var candidate = getCandidate(id: candidateId) else {
            throw CandidateStoreError.notFound
        }

        candidate.verificationResults.append(result)
        candidate.lastVerifiedAt = Date()

        // Recalculate trust score
        candidate.trustScore = calculateTrustScore(for: candidate)

        try await saveCandidate(candidate)
    }

    /// Shortlist candidate
    func shortlistCandidate(_ candidateId: String, shortlisted: Bool) async throws {
        guard var candidate = getCandidate(id: candidateId) else {
            throw CandidateStoreError.notFound
        }

        candidate.isShortlisted = shortlisted
        try await saveCandidate(candidate)
    }

    // MARK: - Private Methods

    private func loadCandidates() async {
        guard let contents = try? fileManager.contentsOfDirectory(at: candidatesDirectory, includingPropertiesForKeys: nil) else {
            return
        }

        var loadedCandidates: [Candidate] = []

        for fileURL in contents where fileURL.pathExtension == "json" {
            do {
                let data = try Data(contentsOf: fileURL)
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                let candidate = try decoder.decode(Candidate.self, from: data)
                loadedCandidates.append(candidate)
            } catch {
                print("Failed to load candidate: \(error)")
            }
        }

        candidates = loadedCandidates
    }

    private func persistCandidate(_ candidate: Candidate) async throws {
        let fileURL = candidatesDirectory.appendingPathComponent("\(candidate.id).json")

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        let data = try encoder.encode(candidate)

        try data.write(to: fileURL)
    }

    private func removeCandidateFromDisk(_ candidateId: String) async throws {
        let fileURL = candidatesDirectory.appendingPathComponent("\(candidateId).json")
        try? fileManager.removeItem(at: fileURL)
    }

    private func calculateTrustScore(for candidate: Candidate) -> Double {
        guard !candidate.verificationResults.isEmpty else {
            return 0.0
        }

        // Calculate average trust score from verification results
        let scores = candidate.verificationResults.map { result in
            result.valid ? 1.0 : 0.0
        }

        let average = scores.reduce(0.0, +) / Double(scores.count)

        // Bonus for multiple successful verifications
        let bonus = min(0.1, Double(candidate.verificationResults.filter { $0.valid }.count) * 0.01)

        return min(1.0, average + bonus)
    }
}

// MARK: - Models

struct Candidate: Codable, Identifiable {
    let id: String
    var name: String
    var email: String?
    var phone: String?
    var credentials: [CandidateCredential]
    var trustScore: Double
    var status: CandidateStatus
    var isShortlisted: Bool
    var verificationResults: [VerificationResult]
    var lastVerifiedAt: Date?
    var addedAt: Date?
    var notes: String?

    init(id: String = UUID().uuidString,
         name: String,
         email: String? = nil,
         phone: String? = nil,
         credentials: [CandidateCredential] = [],
         trustScore: Double = 0.0,
         status: CandidateStatus = .pending,
         isShortlisted: Bool = false,
         verificationResults: [VerificationResult] = [],
         lastVerifiedAt: Date? = nil,
         addedAt: Date? = Date(),
         notes: String? = nil) {
        self.id = id
        self.name = name
        self.email = email
        self.phone = phone
        self.credentials = credentials
        self.trustScore = trustScore
        self.status = status
        self.isShortlisted = isShortlisted
        self.verificationResults = verificationResults
        self.lastVerifiedAt = lastVerifiedAt
        self.addedAt = addedAt
        self.notes = notes
    }
}

struct CandidateCredential: Codable {
    let type: String
    let issuer: String
    let issuedAt: Date?
    let expiresAt: Date?
    let credentialId: String
}

enum CandidateStatus: String, Codable {
    case pending = "Pending"
    case verified = "Verified"
    case rejected = "Rejected"
    case underReview = "Under Review"
}

struct CandidateFilter {
    var minTrustScore: Double?
    var status: CandidateStatus?
    var searchQuery: String?
    var sortBy: SortBy = .trustScore

    enum SortBy {
        case trustScore
        case name
        case dateAdded
    }
}

// MARK: - Errors

enum CandidateStoreError: LocalizedError {
    case notFound
    case saveFailed

    var errorDescription: String? {
        switch self {
        case .notFound:
            return "Candidate not found"
        case .saveFailed:
            return "Failed to save candidate"
        }
    }
}

