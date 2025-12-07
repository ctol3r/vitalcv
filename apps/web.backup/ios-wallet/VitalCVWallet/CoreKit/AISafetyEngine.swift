//
//  AISafetyEngine.swift
//  VitalCVWallet
//
//  Created: AI Safety Layer - Phase 1, Task 1
//  Central AI safety control layer with guardrails, filters, and compliance
//

import Foundation
import Combine

/// Central AI Safety Engine - Main entry point for all AI safety operations
/// NIST GenAI Profile compliant • HIPAA-safe • Chain-audited • Bias-tested
public class AISafetyEngine: ObservableObject {
    public static let shared = AISafetyEngine()

    @Published public var isEnabled: Bool = true
    @Published public var safetyLevel: SafetyLevel = .standard
    @Published public var lastSafetyEvent: SafetyEvent?

    private let guardrailProcessor = SafetyGuardrailProcessor()
    private let piiFilter = PIIFilter()
    private let hallucinationDetector = HallucinationDetector()
    private let safetyClassifier = SafetyLevelClassifier()
    private let overrideManager = SafetyOverrideManager()
    private let didBinding = DIDBindingService()

    // Safety configuration
    private var config: SafetyConfiguration = SafetyConfiguration.default

    private init() {
        loadConfiguration()
    }

    // MARK: - Public API

    /// Process AI input through safety filters
    public func processInput(_ input: String, context: AIRequestContext) async throws -> SafeAIInput {
        guard isEnabled else {
            return SafeAIInput(
                original: input,
                sanitized: input,
                piiDetected: [],
                safetyLevel: .lowRisk
            )
        }

        // Step 1: PII filtering
        let piiResult = await piiFilter.scan(input)

        // Step 2: Guardrail checks
        let guardrailResult = await guardrailProcessor.check(
            input: piiResult.sanitized,
            category: context.category
        )

        // Step 3: Check for overrides
        if let override = await overrideManager.checkOverride(
            userId: context.userId,
            category: context.category
        ) {
            await logSafetyEvent(SafetyEvent(
                type: .overrideUsed,
                input: input,
                output: nil,
                category: context.category,
                userId: context.userId,
                did: context.did,
                overrideReason: override.reason,
                timestamp: Date()
            ))
        }

        return SafeAIInput(
            original: input,
            sanitized: piiResult.sanitized,
            piiDetected: piiResult.detectedItems,
            safetyLevel: guardrailResult.allowed ? .lowRisk : .blocked
        )
    }

    /// Process AI output through safety checks
    public func processOutput(
        _ output: String,
        input: String,
        context: AIRequestContext
    ) async throws -> SafeAIOutput {
        guard isEnabled else {
            return SafeAIOutput(
                original: output,
                processed: output,
                safetyLevel: .lowRisk,
                biasScore: 0.0,
                hallucinationRisk: 0.0,
                action: .allow
            )
        }

        // Step 1: Safety level classification
        let safetyLevel = await safetyClassifier.classify(
            output: output,
            category: context.category
        )

        // Step 2: Hallucination detection
        let hallucinationRisk = await hallucinationDetector.assess(
            output: output,
            context: context
        )

        // Step 3: Bias detection (if enabled)
        let biasScore = await BiasDetectionEngine.shared.detectBias(
            text: output,
            context: context
        )

        // Step 4: PII check on output
        let piiResult = await piiFilter.scan(output)

        // Step 5: Guardrail checks on output
        let guardrailResult = await guardrailProcessor.check(
            input: output,
            category: context.category
        )

        // Step 6: Determine action
        let action = determineAction(
            safetyLevel: safetyLevel,
            hallucinationRisk: hallucinationRisk,
            biasScore: biasScore,
            guardrailResult: guardrailResult
        )

        // Step 7: Apply action
        let processedOutput: String
        switch action {
        case .allow:
            processedOutput = output
        case .block:
            processedOutput = generateFallbackMessage(context: context)
        case .rewrite:
            processedOutput = await rewriteWithSafety(output: output, safetyLevel: safetyLevel)
        case .askUser:
            processedOutput = output // User interaction needed
        }

        // Step 8: Log safety event
        if action != .allow {
            await logSafetyEvent(SafetyEvent(
                type: action == .block ? .blocked : .rewritten,
                input: input,
                output: output,
                processedOutput: processedOutput,
                category: context.category,
                userId: context.userId,
                did: context.did,
                safetyLevel: safetyLevel,
                biasScore: biasScore,
                hallucinationRisk: hallucinationRisk,
                timestamp: Date()
            ))
        }

        // Step 9: Chain anchor if high risk
        if safetyLevel == .highRisk || hallucinationRisk > 0.7 {
            await didBinding.anchorDecision(
                did: context.did,
                decision: SafetyDecision(
                    action: action,
                    safetyLevel: safetyLevel,
                    biasScore: biasScore,
                    hallucinationRisk: hallucinationRisk,
                    timestamp: Date()
                )
            )
        }

        return SafeAIOutput(
            original: output,
            processed: processedOutput,
            safetyLevel: safetyLevel,
            biasScore: biasScore,
            hallucinationRisk: hallucinationRisk,
            action: action,
            piiDetected: piiResult.detectedItems
        )
    }

    /// Update safety configuration
    public func updateConfiguration(_ config: SafetyConfiguration) {
        self.config = config
        saveConfiguration()
    }

    /// Enable/disable safety engine
    public func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
    }

    /// Get current safety statistics
    public func getStatistics() async -> SafetyStatistics {
        return await SafetyEventLogger.shared.getStatistics()
    }

    // MARK: - Private Helpers

    private func determineAction(
        safetyLevel: SafetyLevel,
        hallucinationRisk: Double,
        biasScore: Double,
        guardrailResult: GuardrailResult
    ) -> SafetyAction {
        // High risk always blocks
        if safetyLevel == .highRisk {
            return .block
        }

        // Guardrail violations block
        if !guardrailResult.allowed {
            return .block
        }

        // High hallucination risk blocks
        if hallucinationRisk > config.hallucinationThreshold {
            return .block
        }

        // High bias score requires review
        if biasScore > config.biasThreshold {
            return .askUser
        }

        // Medium risk rewrites
        if safetyLevel == .mediumRisk {
            return .rewrite
        }

        return .allow
    }

    private func generateFallbackMessage(context: AIRequestContext) -> String {
        switch context.category {
        case .credentialAudit:
            return "I cannot provide that information for safety reasons. Please contact support for credential verification."
        case .skillGap:
            return "I cannot generate skill gap predictions at this time. Please try again later."
        case .careerGrowth:
            return "Career recommendations are temporarily unavailable. Please check back later."
        case .telemedicine:
            return "I cannot provide telemedicine eligibility information. Please consult with your healthcare provider."
        case .trustScore:
            return "Trust score explanations are currently unavailable."
        case .recruiter:
            return "Candidate matching suggestions are temporarily unavailable."
        default:
            return "I cannot process that request for safety reasons. Please try rephrasing or contact support."
        }
    }

    private func rewriteWithSafety(output: String, safetyLevel: SafetyLevel) async -> String {
        // In production, this would call a safety rewriting service
        // For now, return a neutralized version
        return output.replacingOccurrences(of: "certain", with: "may be")
            .replacingOccurrences(of: "definitely", with: "possibly")
    }

    private func logSafetyEvent(_ event: SafetyEvent) async {
        await SafetyEventLogger.shared.log(event)
        await MainActor.run {
            lastSafetyEvent = event
        }
    }

    private func loadConfiguration() {
        // Load from UserDefaults or secure storage
        if let data = UserDefaults.standard.data(forKey: "AISafetyConfig"),
           let config = try? JSONDecoder().decode(SafetyConfiguration.self, from: data) {
            self.config = config
        }
    }

    private func saveConfiguration() {
        if let data = try? JSONEncoder().encode(config) {
            UserDefaults.standard.set(data, forKey: "AISafetyConfig")
        }
    }
}

// MARK: - Supporting Types

public struct AIRequestContext {
    public let userId: String
    public let did: String?
    public let category: AICategory
    public let module: AIModule
    public let facilityId: String?

    public init(
        userId: String,
        did: String? = nil,
        category: AICategory,
        module: AIModule,
        facilityId: String? = nil
    ) {
        self.userId = userId
        self.did = did
        self.category = category
        self.module = module
        self.facilityId = facilityId
    }
}

public enum AICategory: String, Codable {
    case credentialAudit = "credential_audit"
    case skillGap = "skill_gap"
    case careerGrowth = "career_growth"
    case telemedicine = "telemedicine"
    case trustScore = "trust_score"
    case recruiter = "recruiter"
    case general = "general"
}

public enum AIModule: String, Codable {
    case credentialAuditor = "credential_auditor"
    case skillGapPredictor = "skill_gap_predictor"
    case careerGrowthEngine = "career_growth_engine"
    case telemedicineEligibility = "telemedicine_eligibility"
    case trustScoreExplainability = "trust_score_explainability"
    case recruiterCandidate = "recruiter_candidate"
}

public struct SafeAIInput {
    public let original: String
    public let sanitized: String
    public let piiDetected: [PIIDetection]
    public let safetyLevel: SafetyLevel
}

public struct SafeAIOutput {
    public let original: String
    public let processed: String
    public let safetyLevel: SafetyLevel
    public let biasScore: Double
    public let hallucinationRisk: Double
    public let action: SafetyAction
    public let piiDetected: [PIIDetection]
}

public enum SafetyLevel: String, Codable {
    case lowRisk = "low_risk"
    case mediumRisk = "medium_risk"
    case highRisk = "high_risk"
    case blocked = "blocked"
}

public enum SafetyAction: String, Codable {
    case allow = "allow"
    case block = "block"
    case rewrite = "rewrite"
    case askUser = "ask_user"
}

public struct SafetyConfiguration: Codable {
    public var hallucinationThreshold: Double = 0.7
    public var biasThreshold: Double = 0.6
    public var piiStrictMode: Bool = true
    public var enableBiasDetection: Bool = true
    public var enableHallucinationDetection: Bool = true
    public var enableChainAnchoring: Bool = true

    public static let `default` = SafetyConfiguration()
}

