//
//  AISafetyModels.swift
//  VitalCVWallet
//
//  Created: AI Safety Layer - Phase 1, Task 2
//  Safety guardrail models and data structures
//

import Foundation

// MARK: - Safety Guardrail Model

/// SafetyGuardrail - Defines a safety rule with category, rule logic, and action
public struct SafetyGuardrail: Codable, Identifiable {
    public let id: String
    public let category: GuardrailCategory
    public let rule: String
    public let action: GuardrailAction
    public let priority: Int
    public let enabled: Bool
    public let createdAt: Date
    public let updatedAt: Date

    public init(
        id: String = UUID().uuidString,
        category: GuardrailCategory,
        rule: String,
        action: GuardrailAction,
        priority: Int = 0,
        enabled: Bool = true,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.category = category
        self.rule = rule
        self.action = action
        self.priority = priority
        self.enabled = enabled
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// GuardrailCategory - NIST GenAI risk categories
public enum GuardrailCategory: String, Codable, CaseIterable {
    case harmfulBias = "harmful_bias"
    case hallucinationRisk = "hallucination_risk"
    case safetyRisk = "safety_risk"
    case privacyRisk = "privacy_risk"
    case informationIntegrity = "information_integrity"

    public var displayName: String {
        switch self {
        case .harmfulBias:
            return "Harmful Bias"
        case .hallucinationRisk:
            return "Hallucination Risk"
        case .safetyRisk:
            return "Safety Risk"
        case .privacyRisk:
            return "Privacy Risk"
        case .informationIntegrity:
            return "Information Integrity"
        }
    }

    public var description: String {
        switch self {
        case .harmfulBias:
            return "Detects unfair or discriminatory language and recommendations"
        case .hallucinationRisk:
            return "Identifies potentially false or unsupported claims"
        case .safetyRisk:
            return "Flags content that could cause harm or violate safety protocols"
        case .privacyRisk:
            return "Identifies potential PII/PHI exposure risks"
        case .informationIntegrity:
            return "Ensures accuracy and authenticity of information"
        }
    }
}

/// GuardrailAction - What to do when a guardrail is triggered
public enum GuardrailAction: String, Codable {
    case block = "block"
    case allow = "allow"
    case askUser = "ask_user"

    public var displayName: String {
        switch self {
        case .block:
            return "Block"
        case .allow:
            return "Allow"
        case .askUser:
            return "Ask User"
        }
    }
}

// MARK: - Safety Event Model

/// SafetyEvent - Records all safety interventions
public struct SafetyEvent: Codable, Identifiable {
    public let id: String
    public let type: SafetyEventType
    public let input: String?
    public let output: String?
    public let processedOutput: String?
    public let category: AICategory?
    public let userId: String
    public let did: String?
    public let safetyLevel: SafetyLevel?
    public let biasScore: Double?
    public let hallucinationRisk: Double?
    public let overrideReason: String?
    public let chainAnchorId: String?
    public let timestamp: Date

    public init(
        id: String = UUID().uuidString,
        type: SafetyEventType,
        input: String? = nil,
        output: String? = nil,
        processedOutput: String? = nil,
        category: AICategory? = nil,
        userId: String,
        did: String? = nil,
        safetyLevel: SafetyLevel? = nil,
        biasScore: Double? = nil,
        hallucinationRisk: Double? = nil,
        overrideReason: String? = nil,
        chainAnchorId: String? = nil,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.input = input
        self.output = output
        self.processedOutput = processedOutput
        self.category = category
        self.userId = userId
        self.did = did
        self.safetyLevel = safetyLevel
        self.biasScore = biasScore
        self.hallucinationRisk = hallucinationRisk
        self.overrideReason = overrideReason
        self.chainAnchorId = chainAnchorId
        self.timestamp = timestamp
    }
}

public enum SafetyEventType: String, Codable {
    case blocked = "blocked"
    case rewritten = "rewritten"
    case flagged = "flagged"
    case overrideUsed = "override_used"
    case piiDetected = "pii_detected"
    case biasDetected = "bias_detected"
    case hallucinationDetected = "hallucination_detected"
}

// MARK: - PII Detection

public struct PIIDetection: Codable {
    public let type: PIIType
    public let value: String
    public let confidence: Double
    public let range: Range<Int>?

    public init(
        type: PIIType,
        value: String,
        confidence: Double,
        range: Range<Int>? = nil
    ) {
        self.type = type
        self.value = value
        self.confidence = confidence
        self.range = range
    }

    // Codable support for Range
    enum CodingKeys: String, CodingKey {
        case type, value, confidence, startIndex, endIndex
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        try container.encode(value, forKey: .value)
        try container.encode(confidence, forKey: .confidence)
        if let range = range {
            try container.encode(range.lowerBound, forKey: .startIndex)
            try container.encode(range.upperBound, forKey: .endIndex)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(PIIType.self, forKey: .type)
        value = try container.decode(String.self, forKey: .value)
        confidence = try container.decode(Double.self, forKey: .confidence)
        if let start = try? container.decode(Int.self, forKey: .startIndex),
           let end = try? container.decode(Int.self, forKey: .endIndex) {
            range = start..<end
        } else {
            range = nil
        }
    }
}

public enum PIIType: String, Codable {
    case ssn = "ssn"
    case name = "name"
    case dateOfBirth = "date_of_birth"
    case phone = "phone"
    case email = "email"
    case address = "address"
    case mrn = "mrn"
    case npi = "npi"
    case licenseNumber = "license_number"

    public var displayName: String {
        switch self {
        case .ssn:
            return "SSN"
        case .name:
            return "Name"
        case .dateOfBirth:
            return "Date of Birth"
        case .phone:
            return "Phone Number"
        case .email:
            return "Email"
        case .address:
            return "Address"
        case .mrn:
            return "Medical Record Number"
        case .npi:
            return "NPI"
        case .licenseNumber:
            return "License Number"
        }
    }
}

// MARK: - Safety Statistics

public struct SafetyStatistics: Codable {
    public let totalEvents: Int
    public let blockedCount: Int
    public let rewrittenCount: Int
    public let flaggedCount: Int
    public let overrideCount: Int
    public let piiDetections: Int
    public let biasDetections: Int
    public let hallucinationDetections: Int
    public let averageBiasScore: Double
    public let averageHallucinationRisk: Double
    public let eventsByCategory: [String: Int]
    public let lastUpdated: Date

    public init(
        totalEvents: Int,
        blockedCount: Int,
        rewrittenCount: Int,
        flaggedCount: Int,
        overrideCount: Int,
        piiDetections: Int,
        biasDetections: Int,
        hallucinationDetections: Int,
        averageBiasScore: Double,
        averageHallucinationRisk: Double,
        eventsByCategory: [String: Int],
        lastUpdated: Date = Date()
    ) {
        self.totalEvents = totalEvents
        self.blockedCount = blockedCount
        self.rewrittenCount = rewrittenCount
        self.flaggedCount = flaggedCount
        self.overrideCount = overrideCount
        self.piiDetections = piiDetections
        self.biasDetections = biasDetections
        self.hallucinationDetections = hallucinationDetections
        self.averageBiasScore = averageBiasScore
        self.averageHallucinationRisk = averageHallucinationRisk
        self.eventsByCategory = eventsByCategory
        self.lastUpdated = lastUpdated
    }
}

// MARK: - Safety Decision (for Chain Anchoring)

public struct SafetyDecision: Codable {
    public let action: SafetyAction
    public let safetyLevel: SafetyLevel
    public let biasScore: Double
    public let hallucinationRisk: Double
    public let timestamp: Date
    public let guardrailsTriggered: [String]?

    public init(
        action: SafetyAction,
        safetyLevel: SafetyLevel,
        biasScore: Double,
        hallucinationRisk: Double,
        timestamp: Date = Date(),
        guardrailsTriggered: [String]? = nil
    ) {
        self.action = action
        self.safetyLevel = safetyLevel
        self.biasScore = biasScore
        self.hallucinationRisk = hallucinationRisk
        self.timestamp = timestamp
        self.guardrailsTriggered = guardrailsTriggered
    }
}

