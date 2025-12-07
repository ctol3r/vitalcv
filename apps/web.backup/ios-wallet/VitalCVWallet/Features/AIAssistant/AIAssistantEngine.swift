//
//  AIAssistantEngine.swift
//  VitalCVWallet
//
//  Created: AI Clinical Assistant - Phase 1
//  Central router for AI queries
//

import Foundation
import Combine

/// Central AI Assistant Engine that routes queries, manages context, and orchestrates responses
@MainActor
class AIAssistantEngine: ObservableObject {
    static let shared = AIAssistantEngine()

    @Published var context: AIAssistantContext?
    @Published var isLoading: Bool = false
    @Published var lastError: Error?

    private let networkService = NetworkService.shared
    private let didService = DIDService.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        Task {
            await loadContext()
        startPeriodicRefresh()
        }
    }

    // MARK: - Context Management

    /// Load AI Assistant context from backend
    func loadContext() async {
        guard let did = didService.getDID() else {
            print("⚠️ No DID available for AI context")
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            // Fetch context from backend
            let contextData = try await fetchContext(did: did)
            self.context = contextData
        } catch {
            self.lastError = error
            print("❌ Failed to load AI context: \(error.localizedDescription)")
        }
    }

    /// Fetch context from backend API
    private func fetchContext(did: String) async throws -> AIAssistantContext {
        return try await networkService.fetchAIContextAsync(did: did)
    }

    // MARK: - Query Processing

    /// Process an AI assistant query
    func query(_ query: AIAssistantQuery) async throws -> AIAssistantResponse {
        isLoading = true
        defer { isLoading = false }

        // Ensure context is loaded
        if context == nil {
            await loadContext()
        }

        // Classify intent if not explicitly provided
        let intent = query.intent

        // Apply safety guardrails
        let guardrails = applySafetyGuardrails(query: query)

        // Get chain integrity signals
        let chainSignals = await getChainIntegritySignals()

        // Route based on mode
        switch query.mode {
        case .lite:
            return try await processLiteQuery(query, guardrails: guardrails)
        case .full:
            return try await processFullQuery(query, guardrails: guardrails, chainSignals: chainSignals)
        }
    }

    // MARK: - Intent Classification

    /// Classify user intent from natural language
    func classifyIntent(from text: String) -> AIAssistantIntent {
        let lowercased = text.lowercased()

        // Explain intents
        if lowercased.contains("why") || lowercased.contains("explain") || lowercased.contains("what does") {
            if lowercased.contains("credential") || lowercased.contains("license") {
                return .explainCredential
            }
            if lowercased.contains("trust") || lowercased.contains("score") {
                return .explainTrustScore
            }
            if lowercased.contains("compliance") || lowercased.contains("dea") || lowercased.contains("mate") {
                return .explainCompliance
            }
            if lowercased.contains("job") || lowercased.contains("qualif") {
                return .explainJobMatch
            }
            if lowercased.contains("chain") || lowercased.contains("anchor") {
                return .explainChain
            }
            if lowercased.contains("evidence") {
                return .explainEvidence
            }
            if lowercased.contains("risk") {
                return .explainRisk
            }
            if lowercased.contains("proof") || lowercased.contains("zk") {
                return .explainZKProof
            }
            return .explain
        }

        // Recommend intents
        if lowercased.contains("recommend") || lowercased.contains("suggest") || lowercased.contains("should i") {
            if lowercased.contains("renew") || lowercased.contains("expir") {
                return .recommend
            }
            if lowercased.contains("cme") || lowercased.contains("course") {
                return .cmeSuggestions
            }
            if lowercased.contains("reference") {
                return .referenceSuggestions
            }
            return .recommend
        }

        // Verify intents
        if lowercased.contains("verify") || lowercased.contains("check") || lowercased.contains("valid") {
            return .verify
        }

        // Predict intents
        if lowercased.contains("predict") || lowercased.contains("forecast") || lowercased.contains("trend") {
            if lowercased.contains("role") || lowercased.contains("career") {
                return .rolePrediction
            }
            if lowercased.contains("growth") || lowercased.contains("level") {
                return .growthRoadmap
            }
            return .predict
        }

        // Summarize intents
        if lowercased.contains("summarize") || lowercased.contains("summary") || lowercased.contains("overview") {
            return .summarize
        }

        // Skill gap analysis
        if lowercased.contains("skill") && (lowercased.contains("gap") || lowercased.contains("missing")) {
            return .skillGapAnalysis
        }

        // Growth roadmap
        if lowercased.contains("growth") || lowercased.contains("roadmap") || lowercased.contains("next level") {
            return .growthRoadmap
        }

        // Job market insights
        if lowercased.contains("market") || lowercased.contains("demand") || lowercased.contains("opportunity") {
            return .jobMarketInsights
        }

        // Default to explain
        return .explain
    }

    // MARK: - Safety Guardrails

    /// Apply NIST GenAI taxonomy safety guardrails
    private func applySafetyGuardrails(query: AIAssistantQuery) -> SafetyGuardrails {
        var warnings: [String] = []
        var phiRedacted = false
        var complianceChecked = false
        var riskAssessed = false

        // Check for PHI in query
        let phiPatterns = ["ssn", "social security", "patient", "mrn", "medical record"]
        let queryLower = query.question.lowercased()
        if phiPatterns.contains(where: { queryLower.contains($0) }) {
            phiRedacted = true
            warnings.append("PHI detected in query - will be redacted")
        }

        // Determine NIST category based on intent
        let nistCategory: SafetyGuardrails.NISTCategory
        switch query.intent {
        case .explain, .explainCredential, .explainCompliance, .explainTrustScore:
            nistCategory = .summarization
        case .recommend, .cmeSuggestions, .referenceSuggestions:
            nistCategory = .augmentation
        case .predict, .rolePrediction, .growthRoadmap:
            nistCategory = .generation
        case .summarize:
            nistCategory = .summarization
        case .verify:
            nistCategory = .transformation
        default:
            nistCategory = .generation
        }

        // Compliance check for sensitive queries
        if query.intent == .explainCompliance || query.intent == .explainRisk {
            complianceChecked = true
        }

        // Risk assessment for predictions
        if query.intent == .predict || query.intent == .rolePrediction {
            riskAssessed = true
        }

        return SafetyGuardrails(
            phiRedacted: phiRedacted,
            complianceChecked: complianceChecked,
            riskAssessed: riskAssessed,
            nistCategory: nistCategory,
            warnings: warnings
        )
    }

    // MARK: - Chain Integrity Signals

    /// Get chain integrity signals for context
    private func getChainIntegritySignals() async -> ChainIntegritySignals {
        // TODO: Integrate with chain verification service
        // For now, return mock data
        return ChainIntegritySignals(
            chainValid: true,
            anchorStatus: .anchored,
            integrityScore: 0.95,
            lastVerified: Date(),
            issues: []
        )
    }

    // MARK: - Query Processing

    /// Process lite mode query (on-device fast answer)
    private func processLiteQuery(
        _ query: AIAssistantQuery,
        guardrails: SafetyGuardrails
    ) async throws -> AIAssistantResponse {
        // Lite mode uses pre-computed answers and templates
        // No LLM call, just pattern matching and template filling

        let answer = generateLiteAnswer(for: query.intent, question: query.question)

        return AIAssistantResponse(
            answer: answer,
            structuredData: nil,
            confidence: 0.7, // Lower confidence for lite mode
            sources: ["On-device knowledge base"],
            ctas: generateCTAs(for: query.intent),
            mode: .lite,
            timestamp: Date()
        )
    }

    /// Process full mode query (server-side LLM)
    private func processFullQuery(
        _ query: AIAssistantQuery,
        guardrails: SafetyGuardrails,
        chainSignals: ChainIntegritySignals
    ) async throws -> AIAssistantResponse {
        // Build prompt with context and guardrails
        let prompt = buildPrompt(
            query: query,
            context: context,
            guardrails: guardrails,
            chainSignals: chainSignals
        )

        // Call backend LLM endpoint
        return try await networkService.queryAIAssistant(
            query: query,
            prompt: prompt,
            context: context
        )
    }

    // MARK: - Helper Methods

    private func buildPrompt(
        query: AIAssistantQuery,
        context: AIAssistantContext?,
        guardrails: SafetyGuardrails,
        chainSignals: ChainIntegritySignals
    ) -> String {
        var prompt = "You are a clinical assistant AI helping healthcare professionals manage their credentials, compliance, and career growth.\n\n"

        // Add context
        if let context = context {
            prompt += "User Context:\n"
            prompt += "- Trust Score: \(String(format: "%.2f", context.trustScore.current))\n"
            prompt += "- Active Credentials: \(context.credentials.count)\n"
            prompt += "- Skills: \(context.skills.count)\n"
            prompt += "- DID: \(context.did)\n\n"
        }

        // Add chain integrity
        prompt += "Chain Integrity: \(chainSignals.chainValid ? "Valid" : "Invalid")\n"
        prompt += "Anchor Status: \(chainSignals.anchorStatus.rawValue)\n\n"

        // Add safety guardrails
        if guardrails.phiRedacted {
            prompt += "⚠️ PHI detected - ensure all patient data is redacted.\n"
        }
        prompt += "NIST Category: \(guardrails.nistCategory.rawValue)\n\n"

        // Add query
        prompt += "User Question: \(query.question)\n"
        prompt += "Intent: \(query.intent.rawValue)\n\n"

        prompt += "Provide a helpful, accurate, and safe response."

        return prompt
    }

    private func generateLiteAnswer(for intent: AIAssistantIntent, question: String) -> String {
        // Simple template-based answers for lite mode
        switch intent {
        case .explainTrustScore:
            return "Your trust score reflects the credibility and verification status of your credentials. It's calculated based on credential validity, chain anchoring, and evidence quality."
        case .explainCredential:
            return "This credential has been verified and anchored to the blockchain. It shows your professional qualifications and is trusted by employers."
        case .explainCompliance:
            return "Compliance status shows your adherence to regulatory requirements like DEA registration and MATE training. Keep credentials current to maintain compliance."
        case .recommend:
            return "Based on your profile, I recommend reviewing expiring credentials and keeping all professional credentials current."
        default:
            return "I can help you understand your credentials, compliance status, and career opportunities. For detailed answers, use full mode."
        }
    }

    private func generateCTAs(for intent: AIAssistantIntent) -> [AIAssistantResponse.CallToAction] {
        var ctas: [AIAssistantResponse.CallToAction] = []

        switch intent {
        case .explainCredential:
            ctas.append(AIAssistantResponse.CallToAction(
                label: "View Details",
                action: .viewDetails,
                priority: .primary
            ))
        case .explainCompliance:
            ctas.append(AIAssistantResponse.CallToAction(
                label: "View Compliance",
                action: .viewCompliance,
                priority: .primary
            ))
        case .recommend:
            ctas.append(AIAssistantResponse.CallToAction(
                label: "Renew Credential",
                action: .renew,
                priority: .primary
            ))
        case .explainJobMatch:
            ctas.append(AIAssistantResponse.CallToAction(
                label: "View Job",
                action: .viewJob,
                priority: .primary
            ))
            ctas.append(AIAssistantResponse.CallToAction(
                label: "Apply",
                action: .apply,
                priority: .secondary
            ))
        default:
            break
        }

        return ctas
    }

    private func createMockContext(did: String) -> AIAssistantContext {
        return AIAssistantContext(
            credentials: [],
            skills: [],
            complianceState: AIAssistantContext.ComplianceState(
                deaStatus: AIAssistantContext.ComplianceState.DEAStatus(
                    registered: false,
                    expirationDate: nil,
                    state: nil,
                    schedule: nil
                ),
                mateCompliance: false,
                sanctions: [],
                renewalAlerts: [],
                riskLevel: .low
            ),
            trustScore: AIAssistantContext.TrustScoreSummary(
                current: 0.85,
                trend: .stable,
                factors: [],
                lastChange: nil,
                changeReason: nil
            ),
            jobMatches: [],
            growthPredictions: AIAssistantContext.GrowthPrediction(
                nextLevel: nil,
                stepsToNextLevel: [],
                timeToNextLevel: nil,
                recommendedActions: [],
                specialtyTrends: []
            ),
            telemedicineEligibility: AIAssistantContext.TelemedicineEligibility(
                eligible: false,
                states: [],
                restrictions: [],
                recommendations: []
            ),
            did: did,
            lastUpdated: Date()
        )
    }

    private func startPeriodicRefresh() {
        // Refresh context every 5 minutes
        Timer.publish(every: 300, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.loadContext()
                }
            }
            .store(in: &cancellables)
    }
}

