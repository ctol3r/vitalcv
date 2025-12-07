//
//  CMEEngine.swift
//  VitalCVWallet
//
//  Created: CME Engine - Phase 1, Task 1
//  Central CME/CEU logic engine for tracking, compliance, and recommendations
//

import Foundation
import Combine

/// CMEEngine - Central engine for CME/CEU tracking and compliance
@MainActor
public class CMEEngine: ObservableObject {
    public static let shared = CMEEngine()

    @Published public private(set) var requirements: [CMERequirement] = []
    @Published public private(set) var creditEntries: [CMECreditEntry] = []
    @Published public private(set) var cycles: [CMECycle] = []
    @Published public private(set) var complianceScore: CMEComplianceScore?
    @Published public private(set) var isLoading: Bool = false
    @Published public private(set) var lastSyncDate: Date?

    private let networkService = NetworkService.shared
    private let trustScoreCalculator = TrustScoreCalculator.shared
    private var cancellables = Set<AnyCancellable>()

    // Cache for AI-parsed requirements
    private var requirementCache: [String: CMERequirement] = [:]

    private init() {
        setupObservers()
    }

    // MARK: - Setup

    private func setupObservers() {
        // Observe credential changes to refresh CME requirements
        NotificationCenter.default.publisher(for: .credentialStoreDidUpdate)
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.refreshRequirements()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Public API - Requirements

    /// Fetch CME requirements for current user
    public func fetchRequirements() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await withCheckedThrowingContinuation { continuation in
                networkService.fetchCMERequirements()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { response in
                            continuation.resume(returning: response)
                        }
                    )
                    .store(in: &self.cancellables)
            }

            requirements = response.requirements
            lastSyncDate = Date()

            // Update cycles based on new requirements
            await updateCycles()
        } catch {
            print("⚠️ Failed to fetch CME requirements: \(error.localizedDescription)")
        }
    }

    /// Refresh requirements (called on credential updates)
    private func refreshRequirements() async {
        await fetchRequirements()
    }

    /// Parse state-specific CME requirements using AI
    public func parseStateRequirements(state: String, specialty: String?) async -> CMERequirement? {
        let cacheKey = "\(state)_\(specialty ?? "general")"

        // Check cache first
        if let cached = requirementCache[cacheKey] {
            return cached
        }

        do {
            let request = CMERequirementParseRequest(state: state, specialty: specialty)
            let response = try await withCheckedThrowingContinuation { continuation in
                networkService.parseCMERequirements(request: request)
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { response in
                            continuation.resume(returning: response)
                        }
                    )
                    .store(in: &self.cancellables)
            }

            // Cache the result
            requirementCache[cacheKey] = response.requirement

            return response.requirement
        } catch {
            print("⚠️ Failed to parse state requirements: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - Public API - Credits

    /// Fetch all CME credit entries
    public func fetchCredits() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await withCheckedThrowingContinuation { continuation in
                networkService.fetchCMECredits()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { response in
                            continuation.resume(returning: response)
                        }
                    )
                    .store(in: &self.cancellables)
            }

            creditEntries = response.credits
            lastSyncDate = Date()

            // Update cycles with new credits
            await updateCycles()
        } catch {
            print("⚠️ Failed to fetch CME credits: \(error.localizedDescription)")
        }
    }

    /// Add a new CME credit entry
    public func addCredit(_ credit: CMECreditEntry) async throws {
        let request = AddCMECreditRequest(credit: credit)

        let response = try await withCheckedThrowingContinuation { continuation in
            networkService.addCMECredit(request: request)
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            continuation.resume(throwing: error)
                        }
                    },
                    receiveValue: { response in
                        continuation.resume(returning: response)
                    }
                )
                .store(in: &self.cancellables)
        }

        // Add to local cache
        creditEntries.append(response.credit)

        // Update cycles
        await updateCycles()

        // Trigger chain anchor intent if evidence uploaded
        if credit.evidenceUploaded && !credit.chainAnchored {
            await triggerChainAnchor(for: response.credit.id)
        }
    }

    /// Trigger chain anchor for CME evidence
    private func triggerChainAnchor(for creditId: String) async {
        // This will be implemented with the chain anchoring system
        // For now, just log the intent
        print("🔗 Chain anchor intent for CME credit: \(creditId)")
    }

    // MARK: - Public API - Cycles

    /// Update CME cycles based on current requirements and credits
    private func updateCycles() async {
        var updatedCycles: [CMECycle] = []

        for requirement in requirements {
            // Find or create cycle for this requirement
            let cycle = calculateCycle(for: requirement)
            updatedCycles.append(cycle)
        }

        cycles = updatedCycles

        // Recalculate compliance score
        await calculateComplianceScore()
    }

    /// Calculate CME cycle from requirement and credits
    private func calculateCycle(for requirement: CMERequirement) -> CMECycle {
        let calendar = Calendar.current
        let now = Date()

        // Determine cycle dates based on time period
        let cycleStart: Date
        let cycleEnd: Date

        if let expirationDate = requirement.expirationDate {
            cycleEnd = expirationDate
            cycleStart = calendar.date(byAdding: .year, value: -requirement.timePeriod.years, to: cycleEnd) ?? requirement.effectiveDate
        } else {
            // Default to current year/biennium
            let year = calendar.component(.year, from: now)
            if requirement.timePeriod == .biennial {
                let bienniumStart = (year / 2) * 2
                cycleStart = calendar.date(from: DateComponents(year: bienniumStart, month: 1, day: 1)) ?? now
                cycleEnd = calendar.date(byAdding: .year, value: 2, to: cycleStart) ?? now
            } else {
                cycleStart = calendar.date(from: DateComponents(year: year, month: 1, day: 1)) ?? now
                cycleEnd = calendar.date(byAdding: .year, value: 1, to: cycleStart) ?? now
            }
        }

        // Filter credits for this cycle
        let cycleCredits = creditEntries.filter { credit in
            credit.completionDate >= cycleStart && credit.completionDate <= cycleEnd
        }

        // Calculate hours by category
        var totalHours: Double = 0.0
        var generalHours: Double = 0.0
        var specialtyHours: Double = 0.0
        var controlledSubstancesHours: Double = 0.0

        for credit in cycleCredits {
            totalHours += credit.hours

            switch credit.category {
            case .general:
                generalHours += credit.hours
            case .specialty:
                specialtyHours += credit.hours
            case .controlledSubstances:
                controlledSubstancesHours += credit.hours
            default:
                generalHours += credit.hours // Default to general
            }
        }

        // Calculate days remaining
        let daysRemaining = calendar.dateComponents([.day], from: now, to: cycleEnd).day ?? 0
        let isExpired = now > cycleEnd

        // Determine compliance status
        let complianceStatus: CMEComplianceStatus
        if totalHours >= requirement.requiredHours {
            complianceStatus = isExpired ? .expired : .compliant
        } else if isExpired {
            complianceStatus = .nonCompliant
        } else if daysRemaining <= 30 {
            complianceStatus = .atRisk
        } else {
            complianceStatus = .inProgress
        }

        return CMECycle(
            id: requirement.id,
            startDate: cycleStart,
            endDate: cycleEnd,
            completedHours: totalHours,
            requiredHours: requirement.requiredHours,
            requirementId: requirement.id,
            creditEntries: cycleCredits.map { $0.id },
            complianceStatus: complianceStatus,
            generalHours: generalHours,
            specialtyHours: specialtyHours,
            controlledSubstancesHours: controlledSubstancesHours,
            daysRemaining: daysRemaining,
            isExpired: isExpired
        )
    }

    // MARK: - Compliance Score Calculation

    /// Calculate CME compliance score for trust score integration
    private func calculateComplianceScore() async {
        guard !cycles.isEmpty else {
            complianceScore = CMEComplianceScore(
                overallScore: 0.0,
                currentCycleScore: 0.0,
                historicalCompliance: 0.0,
                riskFactors: ["No CME cycles found"]
            )
            return
        }

        // Current cycle score
        let currentCycle = cycles.first { !$0.isExpired } ?? cycles.first
        let currentCycleScore = currentCycle?.progressPercentage ?? 0.0

        // Historical compliance (simplified - would use past cycles in production)
        let historicalCompliance = cycles.filter { $0.complianceStatus == .compliant || $0.complianceStatus == .expired }.count > 0 ? 1.0 : 0.0

        // Category breakdown
        var categoryBreakdown: [String: Double] = [:]
        if let current = currentCycle {
            categoryBreakdown["general"] = current.generalHours / max(current.requiredHours, 1.0)
            categoryBreakdown["specialty"] = current.specialtyHours / max(current.requiredHours, 1.0)
            categoryBreakdown["controlled_substances"] = current.controlledSubstancesHours / max(current.requiredHours, 1.0)
        }

        // Risk factors
        var riskFactors: [String] = []
        if let current = currentCycle {
            if current.complianceStatus == .nonCompliant {
                riskFactors.append("Non-compliant with CME requirements")
            }
            if current.complianceStatus == .atRisk {
                riskFactors.append("CME deadline approaching")
            }
            if current.hoursRemaining > 0 && current.daysRemaining < 60 {
                riskFactors.append("\(current.hoursRemaining) hours needed in \(current.daysRemaining) days")
            }
        }

        // Overall score (weighted: 60% current, 40% historical)
        let overallScore = (currentCycleScore * 0.6) + (historicalCompliance * 0.4)

        complianceScore = CMEComplianceScore(
            overallScore: overallScore,
            currentCycleScore: currentCycleScore,
            historicalCompliance: historicalCompliance,
            categoryBreakdown: categoryBreakdown,
            riskFactors: riskFactors
        )

        // Notify trust score calculator of update
        await updateTrustScore()
    }

    /// Update trust score with CME compliance data
    private func updateTrustScore() async {
        // This integrates with TrustScoreCalculator
        // The compliance score will be used in the trust score calculation
        // Implementation depends on how TrustScoreCalculator accepts CME data
        if let score = complianceScore {
            // Post notification for trust score update
            NotificationCenter.default.post(
                name: .cmeComplianceScoreUpdated,
                object: nil,
                userInfo: ["score": score]
            )
        }
    }

    // MARK: - Auto-categorization

    /// Auto-categorize CME credit based on specialty/domain
    public func autoCategorizeCredit(title: String, provider: String, specialty: String?) -> CMECreditCategory {
        let lowerTitle = title.lowercased()
        let lowerProvider = provider.lowercased()

        // Check for controlled substances keywords
        if lowerTitle.contains("dea") || lowerTitle.contains("mate") ||
           lowerTitle.contains("controlled substance") || lowerTitle.contains("opioid") {
            return .controlledSubstances
        }

        // Check for telemedicine
        if lowerTitle.contains("telemedicine") || lowerTitle.contains("telehealth") {
            return .telemedicine
        }

        // Check for ethics
        if lowerTitle.contains("ethics") || lowerTitle.contains("ethical") {
            return .ethics
        }

        // Check for patient safety
        if lowerTitle.contains("patient safety") || lowerTitle.contains("safety") {
            return .patientSafety
        }

        // If specialty is provided, it's specialty-specific
        if specialty != nil {
            return .specialty
        }

        // Default to general
        return .general
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let cmeComplianceScoreUpdated = Notification.Name("cmeComplianceScoreUpdated")
    static let credentialStoreDidUpdate = Notification.Name("credentialStoreDidUpdate")
}

// MARK: - Network Request/Response Models

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

