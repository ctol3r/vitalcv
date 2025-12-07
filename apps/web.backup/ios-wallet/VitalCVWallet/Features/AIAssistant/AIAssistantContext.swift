//
//  AIAssistantContext.swift
//  VitalCVWallet
//
//  Created: AI Clinical Assistant - Phase 1
//  AI Assistant Context Model
//

import Foundation

// MARK: - AI Assistant Context

struct AIAssistantContext: Codable, Equatable {
    let credentials: [CredentialSummary]
    let skills: [SkillSummary]
    let complianceState: ComplianceState
    let trustScore: TrustScoreSummary
    let jobMatches: [JobMatchSummary]
    let growthPredictions: GrowthPrediction
    let telemedicineEligibility: TelemedicineEligibility
    let did: String
    let lastUpdated: Date

    struct CredentialSummary: Codable, Equatable {
        let id: String
        let type: String
        let issuer: String
        let status: CredentialStatus
        let expirationDate: Date?
        let trustLevel: Int // 1-5
        let chainAnchorId: String?

        enum CredentialStatus: String, Codable {
            case active
            case expiring
            case expired
            case revoked
            case pending
        }
    }

    struct SkillSummary: Codable, Equatable {
        let id: String
        let name: String
        let category: SkillCategory
        let level: SkillLevel
        let verified: Bool
        let evidenceCount: Int

        enum SkillCategory: String, Codable {
            case clinical
            case technical
            case administrative
            case communication
            case leadership
        }

        enum SkillLevel: String, Codable {
            case beginner
            case intermediate
            case advanced
            case expert
        }
    }

    struct ComplianceState: Codable, Equatable {
        let deaStatus: DEAStatus
        let mateCompliance: Bool
        let sanctions: [Sanction]
        let renewalAlerts: [RenewalAlert]
        let riskLevel: RiskLevel

        struct DEAStatus: Codable, Equatable {
            let registered: Bool
            let expirationDate: Date?
            let state: String?
            let schedule: String?
        }

        struct Sanction: Codable, Equatable {
            let id: String
            let type: String
            let severity: String
            let date: Date
            let resolved: Bool
        }

        struct RenewalAlert: Codable, Equatable {
            let credentialId: String
            let credentialType: String
            let daysUntilExpiry: Int
            let priority: AlertPriority
        }

        enum RiskLevel: String, Codable {
            case low
            case medium
            case high
            case critical
        }

        enum AlertPriority: String, Codable {
            case low
            case medium
            case high
        }
    }

    struct TrustScoreSummary: Codable, Equatable {
        let current: Double // 0.0 - 1.0
        let trend: TrustTrend
        let factors: [TrustFactor]
        let lastChange: Date?
        let changeReason: String?

        enum TrustTrend: String, Codable {
            case increasing
            case stable
            case decreasing
        }

        struct TrustFactor: Codable, Equatable {
            let name: String
            let impact: Double // -1.0 to 1.0
            let description: String
        }
    }

    struct JobMatchSummary: Codable, Equatable {
        let jobId: String
        let title: String
        let organization: String
        let matchScore: Double // 0.0 - 1.0
        let qualificationStatus: QualificationStatus
        let missingRequirements: [String]

        enum QualificationStatus: String, Codable {
            case fullyQualified
            case mostlyQualified
            case partiallyQualified
            case notQualified
        }
    }

    struct GrowthPrediction: Codable, Equatable {
        let nextLevel: String?
        let stepsToNextLevel: [String]
        let timeToNextLevel: String? // e.g., "3-6 months"
        let recommendedActions: [String]
        let specialtyTrends: [SpecialtyTrend]

        struct SpecialtyTrend: Codable, Equatable {
            let specialty: String
            let demand: DemandLevel
            let growthRate: Double
        }

        enum DemandLevel: String, Codable {
            case veryHigh
            case high
            case medium
            case low
        }
    }

    struct TelemedicineEligibility: Codable, Equatable {
        let eligible: Bool
        let states: [String] // Licensed states
        let restrictions: [String]
        let recommendations: [String]
    }
}

// MARK: - AI Assistant Intent

enum AIAssistantIntent: String, Codable {
    case explain
    case recommend
    case verify
    case predict
    case summarize
    case explainCredential
    case explainCompliance
    case explainTrustScore
    case explainJobMatch
    case explainGrowth
    case explainChain
    case explainEvidence
    case explainRisk
    case explainZKProof
    case explainSelectiveDisclosure
    case explainGraphRelationship
    case skillGapAnalysis
    case growthRoadmap
    case cmeSuggestions
    case rolePrediction
    case workLifeFit
    case referenceSuggestions
    case endorsementStrategy
    case jobMarketInsights
    case recruiterMode
    case hospitalMode
    case explainAnomalies
    case createShortlist
    case schedulingRecommendations
    case unitReadinessAnalysis
    case complianceAudit
}

// MARK: - AI Assistant Query

struct AIAssistantQuery: Codable {
    let intent: AIAssistantIntent
    let question: String
    let context: QueryContext?
    let mode: QueryMode
    let userId: String
    let did: String

    struct QueryContext: Codable {
        let credentialId: String?
        let jobId: String?
        let skillId: String?
        let complianceArea: String?
        let chainAnchorId: String?
    }

    enum QueryMode: String, Codable {
        case full // Server-side LLM
        case lite // On-device fast answer
    }
}

// MARK: - AI Assistant Response

struct AIAssistantResponse: Codable {
    let answer: String
    let structuredData: StructuredAnswer?
    let confidence: Double // 0.0 - 1.0
    let sources: [String]
    let ctas: [CallToAction]
    let mode: ResponseMode
    let timestamp: Date

    struct StructuredAnswer: Codable {
        let sections: [AnswerSection]
        let summary: String?

        struct AnswerSection: Codable {
            let title: String
            let content: String
            let type: SectionType
            let items: [String]?

            enum SectionType: String, Codable {
                case list
                case explanation
                case recommendation
                case warning
                case success
            }
        }
    }

    struct CallToAction: Codable {
        let label: String
        let action: CTAAction
        let priority: CTAPriority

        enum CTAAction: String, Codable {
            case renew
            case verify
            case apply
            case viewDetails
            case updateCredential
            case requestReference
            case scheduleCME
            case viewJob
            case viewCompliance
        }

        enum CTAPriority: String, Codable {
            case primary
            case secondary
            case tertiary
        }
    }

    enum ResponseMode: String, Codable {
        case full
        case lite
    }
}

// MARK: - Safety Guardrails

struct SafetyGuardrails: Codable {
    let phiRedacted: Bool
    let complianceChecked: Bool
    let riskAssessed: Bool
    let nistCategory: NISTCategory
    let warnings: [String]

    enum NISTCategory: String, Codable {
        case generation
        case augmentation
        case summarization
        case transformation
        case synthesis
    }
}

// MARK: - Chain Integrity Signals

struct ChainIntegritySignals: Codable {
    let chainValid: Bool
    let anchorStatus: AnchorStatus
    let integrityScore: Double // 0.0 - 1.0
    let lastVerified: Date?
    let issues: [String]

    enum AnchorStatus: String, Codable {
        case anchored
        case pending
        case stale
        case invalid
    }
}

