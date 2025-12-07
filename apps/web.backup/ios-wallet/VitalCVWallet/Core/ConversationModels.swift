//
//  ConversationModels.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 1
//  Models for conversation engine
//

import Foundation

// MARK: - Conversation Actor

/// Represents entities that can participate in credential conversations
public enum ConversationActor: String, Codable, Equatable, Identifiable {
    case clinician
    case hospital
    case recruiter
    case stateBoard
    case dea
    case cmsPecos
    case payer
    case trainingProgram
    case privilegingOffice
    case skillSupervisor
    case aiAuditor

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .clinician: return "Clinician"
        case .hospital: return "Hospital"
        case .recruiter: return "Recruiter"
        case .stateBoard: return "State Board"
        case .dea: return "DEA"
        case .cmsPecos: return "CMS/PECOS"
        case .payer: return "Payer"
        case .trainingProgram: return "Training Program"
        case .privilegingOffice: return "Privileging Office"
        case .skillSupervisor: return "Skill Supervisor"
        case .aiAuditor: return "AI Auditor"
        }
    }

    public var iconName: String {
        switch self {
        case .clinician: return "person.circle.fill"
        case .hospital: return "building.2.fill"
        case .recruiter: return "person.2.fill"
        case .stateBoard: return "shield.checkered"
        case .dea: return "lock.shield.fill"
        case .cmsPecos: return "doc.text.fill"
        case .payer: return "creditcard.fill"
        case .trainingProgram: return "graduationcap.fill"
        case .privilegingOffice: return "checkmark.seal.fill"
        case .skillSupervisor: return "person.badge.plus.fill"
        case .aiAuditor: return "brain.head.profile"
        }
    }

    public var colorHex: String {
        switch self {
        case .clinician: return "#3B82F6" // Blue
        case .hospital: return "#10B981" // Green
        case .recruiter: return "#F59E0B" // Amber
        case .stateBoard: return "#8B5CF6" // Purple
        case .dea: return "#EF4444" // Red
        case .cmsPecos: return "#06B6D4" // Cyan
        case .payer: return "#6366F1" // Indigo
        case .trainingProgram: return "#EC4899" // Pink
        case .privilegingOffice: return "#14B8A6" // Teal
        case .skillSupervisor: return "#F97316" // Orange
        case .aiAuditor: return "#A855F7" // Violet
        }
    }
}

// MARK: - Conversation Context

/// Context for a credential conversation
public struct ConversationContext: Codable, Equatable {
    let credentialSet: [String] // Credential IDs
    let chainData: ChainData?
    let compliance: ComplianceData?
    let skills: [SkillData]?
    let scopeRules: [ScopeRule]?
    let facilityNeeds: FacilityNeeds?
    let clinicianId: String?

    public init(
        credentialSet: [String] = [],
        chainData: ChainData? = nil,
        compliance: ComplianceData? = nil,
        skills: [SkillData]? = nil,
        scopeRules: [ScopeRule]? = nil,
        facilityNeeds: FacilityNeeds? = nil,
        clinicianId: String? = nil
    ) {
        self.credentialSet = credentialSet
        self.chainData = chainData
        self.compliance = compliance
        self.skills = skills
        self.scopeRules = scopeRules
        self.facilityNeeds = facilityNeeds
        self.clinicianId = clinicianId
    }
}

public struct ChainData: Codable, Equatable {
    let anchorId: String?
    let chainLength: Int?
    let lastVerified: Date?
    let valid: Bool?
}

public struct ComplianceData: Codable, Equatable {
    let status: String
    let issues: [String]
    let lastAudit: Date?
}

public struct SkillData: Codable, Equatable {
    let skillId: String
    let name: String
    let level: String
    let verified: Bool
}

public struct ScopeRule: Codable, Equatable {
    let ruleId: String
    let description: String
    let applicableStates: [String]
}

public struct FacilityNeeds: Codable, Equatable {
    let facilityId: String
    let requirements: [String]
    let priority: String
}

// MARK: - Signed Context

public struct SignedConversationContext: Codable {
    let context: ConversationContext
    let did: String
    let dpopToken: String
    let signature: String
    let timestamp: Date
}

// MARK: - Conversation

public struct Conversation: Identifiable, Codable, Equatable {
    let id: String
    let context: ConversationContext
    let actors: [ConversationActor]
    var status: ConversationStatus
    let createdAt: Date
    var lastMessageAt: Date?

    public init(
        id: String,
        context: ConversationContext,
        actors: [ConversationActor],
        status: ConversationStatus,
        createdAt: Date,
        lastMessageAt: Date? = nil
    ) {
        self.id = id
        self.context = context
        self.actors = actors
        self.status = status
        self.createdAt = createdAt
        self.lastMessageAt = lastMessageAt
    }
}

public enum ConversationStatus: String, Codable, Equatable {
    case active
    case pending
    case completed
    case failed
    case escalated
}

// MARK: - Messages

public struct ConversationMessage: Identifiable, Codable, Equatable {
    let id: String
    let conversationId: String
    let fromActor: ConversationActor
    let toActors: [ConversationActor]?
    let content: String
    let timestamp: Date
    let verified: Bool?
    let chainAnchorId: String?
    let messageType: MessageType
    let metadata: [String: String]?

    public init(
        id: String = UUID().uuidString,
        conversationId: String,
        fromActor: ConversationActor,
        toActors: [ConversationActor]? = nil,
        content: String,
        timestamp: Date = Date(),
        verified: Bool? = nil,
        chainAnchorId: String? = nil,
        messageType: MessageType = .text,
        metadata: [String: String]? = nil
    ) {
        self.id = id
        self.conversationId = conversationId
        self.fromActor = fromActor
        self.toActors = toActors
        self.content = content
        self.timestamp = timestamp
        self.verified = verified
        self.chainAnchorId = chainAnchorId
        self.messageType = messageType
        self.metadata = metadata
    }
}

public enum MessageType: String, Codable, Equatable {
    case text
    case verification
    case conflict
    case escalation
    case consensus
}

// MARK: - Requests

public struct ConversationRequest: Codable {
    let conversationId: String
    let context: SignedConversationContext
    let actors: [ConversationActor]
    let message: String?
}

public struct MessageRequest: Codable {
    let conversationId: String
    let message: String
    let fromActor: ConversationActor
    let context: ConversationContext
}

public struct RoutingRequest: Codable {
    let conversationId: String
    let message: String
    let targetActors: [ConversationActor]
}

// MARK: - Responses

public struct ConversationResponse: Codable {
    let conversationId: String
    let status: ConversationStatus
    let messages: [ConversationMessage]
    let suggestedActions: [String]?
}

