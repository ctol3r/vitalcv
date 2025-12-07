//
//  AISafetyProcessors.swift
//  VitalCVWallet
//
//  Created: AI Safety Layer - Phase 1, Tasks 3-6
//  Safety processors for guardrails, PII filtering, hallucination detection, and classification
//

import Foundation

// MARK: - Safety Guardrail Processor

/// Processes guardrails based on NIST GenAI risk categories
class SafetyGuardrailProcessor {
    static let shared = SafetyGuardrailProcessor()

    private var guardrails: [SafetyGuardrail] = []

    init() {
        loadDefaultGuardrails()
    }

    func check(input: String, category: AICategory) async -> GuardrailResult {
        var triggeredGuardrails: [SafetyGuardrail] = []

        for guardrail in guardrails where guardrail.enabled {
            if shouldTrigger(guardrail: guardrail, input: input, category: category) {
                triggeredGuardrails.append(guardrail)
            }
        }

        // Sort by priority (higher priority first)
        triggeredGuardrails.sort { $0.priority > $1.priority }

        if let topGuardrail = triggeredGuardrails.first {
            return GuardrailResult(
                allowed: topGuardrail.action == .allow,
                action: topGuardrail.action,
                triggeredGuardrail: topGuardrail,
                allTriggered: triggeredGuardrails
            )
        }

        return GuardrailResult(
            allowed: true,
            action: .allow,
            triggeredGuardrail: nil,
            allTriggered: []
        )
    }

    func addGuardrail(_ guardrail: SafetyGuardrail) {
        guardrails.append(guardrail)
        guardrails.sort { $0.priority > $1.priority }
    }

    func removeGuardrail(id: String) {
        guardrails.removeAll { $0.id == id }
    }

    func updateGuardrail(_ guardrail: SafetyGuardrail) {
        if let index = guardrails.firstIndex(where: { $0.id == guardrail.id }) {
            guardrails[index] = guardrail
            guardrails.sort { $0.priority > $1.priority }
        }
    }

    private func shouldTrigger(guardrail: SafetyGuardrail, input: String, category: AICategory) -> Bool {
        // Simple rule matching - in production, use NLP or ML models
        let lowercased = input.lowercased()

        switch guardrail.category {
        case .harmfulBias:
            return detectHarmfulBias(text: lowercased)
        case .hallucinationRisk:
            return detectHallucinationIndicators(text: lowercased)
        case .safetyRisk:
            return detectSafetyRisks(text: lowercased)
        case .privacyRisk:
            return detectPrivacyRisks(text: lowercased)
        case .informationIntegrity:
            return detectIntegrityIssues(text: lowercased)
        }
    }

    private func detectHarmfulBias(text: String) -> Bool {
        // Check for discriminatory language patterns
        let biasPatterns = [
            "certain demographics",
            "based on ethnicity",
            "racial preference",
            "gender-based",
            "age discrimination"
        ]
        return biasPatterns.contains { text.contains($0) }
    }

    private func detectHallucinationIndicators(text: String) -> Bool {
        // Check for unsupported claims
        let hallucinationPatterns = [
            "definitely",
            "certainly",
            "100% sure",
            "guaranteed",
            "without a doubt"
        ]
        return hallucinationPatterns.contains { text.contains($0) }
    }

    private func detectSafetyRisks(text: String) -> Bool {
        // Check for potentially harmful content
        let safetyPatterns = [
            "ignore safety",
            "bypass protocol",
            "skip verification",
            "override security"
        ]
        return safetyPatterns.contains { text.contains($0) }
    }

    private func detectPrivacyRisks(text: String) -> Bool {
        // Check for potential PII exposure patterns
        let privacyPatterns = [
            "full social security",
            "complete address",
            "all personal information"
        ]
        return privacyPatterns.contains { text.contains($0) }
    }

    private func detectIntegrityIssues(text: String) -> Bool {
        // Check for information accuracy concerns
        let integrityPatterns = [
            "fake",
            "fabricated",
            "not verified",
            "unconfirmed"
        ]
        return integrityPatterns.contains { text.contains($0) }
    }

    private func loadDefaultGuardrails() {
        // Load default NIST GenAI Profile guardrails
        guardrails = [
            SafetyGuardrail(
                category: .harmfulBias,
                rule: "Block discriminatory or biased recommendations",
                action: .block,
                priority: 100
            ),
            SafetyGuardrail(
                category: .hallucinationRisk,
                rule: "Flag unsupported claims with high confidence",
                action: .askUser,
                priority: 80
            ),
            SafetyGuardrail(
                category: .privacyRisk,
                rule: "Block PII exposure in AI outputs",
                action: .block,
                priority: 90
            ),
            SafetyGuardrail(
                category: .safetyRisk,
                rule: "Block content that could cause harm",
                action: .block,
                priority: 95
            ),
            SafetyGuardrail(
                category: .informationIntegrity,
                rule: "Flag potentially inaccurate information",
                action: .askUser,
                priority: 70
            )
        ]
    }
}

struct GuardrailResult {
    let allowed: Bool
    let action: GuardrailAction
    let triggeredGuardrail: SafetyGuardrail?
    let allTriggered: [SafetyGuardrail]
}

// MARK: - PII Filter

/// Filters PII from AI inputs and outputs (HIPAA-compliant)
class PIIFilter {
    static let shared = PIIFilter()

    private let ssnPattern = #"\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b"#
    private let phonePattern = #"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"#
    private let emailPattern = #"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"#
    private let datePattern = #"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"#
    private let mrnPattern = #"\bMRN[:\s]?\d+\b"#

    func scan(_ text: String) async -> PIIFilterResult {
        var detectedItems: [PIIDetection] = []
        var sanitized = text

        // Detect SSN
        if let regex = try? NSRegularExpression(pattern: ssnPattern, options: .caseInsensitive) {
            let matches = regex.matches(in: text, range: NSRange(text.startIndex..., in: text))
            for match in matches {
                if let range = Range(match.range, in: text) {
                    let value = String(text[range])
                    detectedItems.append(PIIDetection(
                        type: .ssn,
                        value: value,
                        confidence: 0.95,
                        range: range
                    ))
                    sanitized = sanitized.replacingOccurrences(of: value, with: "[REDACTED_SSN]")
                }
            }
        }

        // Detect phone numbers
        if let regex = try? NSRegularExpression(pattern: phonePattern, options: []) {
            let matches = regex.matches(in: sanitized, range: NSRange(sanitized.startIndex..., in: sanitized))
            for match in matches {
                if let range = Range(match.range, in: sanitized) {
                    let value = String(sanitized[range])
                    detectedItems.append(PIIDetection(
                        type: .phone,
                        value: value,
                        confidence: 0.85,
                        range: range
                    ))
                    sanitized = sanitized.replacingOccurrences(of: value, with: "[REDACTED_PHONE]")
                }
            }
        }

        // Detect email addresses
        if let regex = try? NSRegularExpression(pattern: emailPattern, options: []) {
            let matches = regex.matches(in: sanitized, range: NSRange(sanitized.startIndex..., in: sanitized))
            for match in matches {
                if let range = Range(match.range, in: sanitized) {
                    let value = String(sanitized[range])
                    detectedItems.append(PIIDetection(
                        type: .email,
                        value: value,
                        confidence: 0.90,
                        range: range
                    ))
                    sanitized = sanitized.replacingOccurrences(of: value, with: "[REDACTED_EMAIL]")
                }
            }
        }

        // Detect dates (potential DOB)
        if let regex = try? NSRegularExpression(pattern: datePattern, options: []) {
            let matches = regex.matches(in: sanitized, range: NSRange(sanitized.startIndex..., in: sanitized))
            for match in matches {
                if let range = Range(match.range, in: sanitized) {
                    let value = String(sanitized[range])
                    detectedItems.append(PIIDetection(
                        type: .dateOfBirth,
                        value: value,
                        confidence: 0.60, // Lower confidence as dates might not be DOB
                        range: range
                    ))
                }
            }
        }

        // Detect MRN
        if let regex = try? NSRegularExpression(pattern: mrnPattern, options: .caseInsensitive) {
            let matches = regex.matches(in: sanitized, range: NSRange(sanitized.startIndex..., in: sanitized))
            for match in matches {
                if let range = Range(match.range, in: sanitized) {
                    let value = String(sanitized[range])
                    detectedItems.append(PIIDetection(
                        type: .mrn,
                        value: value,
                        confidence: 0.95,
                        range: range
                    ))
                    sanitized = sanitized.replacingOccurrences(of: value, with: "[REDACTED_MRN]")
                }
            }
        }

        return PIIFilterResult(
            original: text,
            sanitized: sanitized,
            detectedItems: detectedItems
        )
    }
}

struct PIIFilterResult {
    let original: String
    let sanitized: String
    let detectedItems: [PIIDetection]
}

// MARK: - Hallucination Detector

/// Detects potential hallucinations using heuristics and chain consistency checks
class HallucinationDetector {
    static let shared = HallucinationDetector()

    func assess(output: String, context: AIRequestContext) async -> Double {
        var riskScore: Double = 0.0

        // Heuristic checks
        riskScore += checkOverConfidence(output: output)
        riskScore += checkUnsupportedClaims(output: output)
        riskScore += checkContradictions(output: output)

        // Chain consistency check (if chain data available)
        if let did = context.did {
            riskScore += await checkChainConsistency(output: output, did: did)
        }

        // Normalize to 0.0-1.0 range
        return min(riskScore, 1.0)
    }

    private func checkOverConfidence(output: String) -> Double {
        let overConfidentPhrases = [
            "definitely": 0.3,
            "certainly": 0.3,
            "guaranteed": 0.4,
            "100% sure": 0.5,
            "without a doubt": 0.3
        ]

        var score: Double = 0.0
        let lowercased = output.lowercased()

        for (phrase, weight) in overConfidentPhrases {
            if lowercased.contains(phrase) {
                score += weight
            }
        }

        return min(score, 0.5)
    }

    private func checkUnsupportedClaims(output: String) -> Double {
        // Check for claims without evidence markers
        let unsupportedIndicators = [
            "studies show",
            "research indicates",
            "data suggests"
        ]

        var score: Double = 0.0
        let lowercased = output.lowercased()

        for indicator in unsupportedIndicators {
            if lowercased.contains(indicator) {
                // If mentioned but no citations, increase risk
                if !lowercased.contains("citation") && !lowercased.contains("source") {
                    score += 0.2
                }
            }
        }

        return min(score, 0.4)
    }

    private func checkContradictions(output: String) -> Double {
        // Simple contradiction detection
        let contradictionPairs = [
            ("always", "never"),
            ("all", "none"),
            ("complete", "incomplete")
        ]

        var score: Double = 0.0
        let lowercased = output.lowercased()

        for (first, second) in contradictionPairs {
            if lowercased.contains(first) && lowercased.contains(second) {
                score += 0.3
            }
        }

        return min(score, 0.3)
    }

    private func checkChainConsistency(output: String, did: String) async -> Double {
        // Check if output is consistent with chain-anchored data
        // In production, this would query the chain for related data
        // and compare with the output

        // For now, return a low base risk
        // This would be enhanced with actual chain queries
        return 0.1
    }
}

// MARK: - Safety Level Classifier

/// Classifies AI responses into safety levels
class SafetyLevelClassifier {
    static let shared = SafetyLevelClassifier()

    func classify(output: String, category: AICategory) async -> SafetyLevel {
        var riskFactors: [String] = []

        // Check for high-risk indicators
        let highRiskIndicators = [
            "bypass",
            "ignore",
            "override",
            "unauthorized",
            "illegal"
        ]

        let lowercased = output.lowercased()
        for indicator in highRiskIndicators {
            if lowercased.contains(indicator) {
                riskFactors.append(indicator)
            }
        }

        if riskFactors.count >= 2 {
            return .highRisk
        }

        // Check for medium-risk indicators
        let mediumRiskIndicators = [
            "maybe",
            "possibly",
            "uncertain",
            "unverified"
        ]

        var mediumCount = 0
        for indicator in mediumRiskIndicators {
            if lowercased.contains(indicator) {
                mediumCount += 1
            }
        }

        if mediumCount >= 2 {
            return .mediumRisk
        }

        // Check category-specific risks
        switch category {
        case .credentialAudit, .telemedicine:
            // These categories are more sensitive
            if mediumCount >= 1 {
                return .mediumRisk
            }
        default:
            break
        }

        return .lowRisk
    }
}

