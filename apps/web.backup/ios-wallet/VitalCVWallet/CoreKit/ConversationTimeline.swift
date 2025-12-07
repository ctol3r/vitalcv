//
//  ConversationTimeline.swift
//  VitalCVWallet
//
//  Created: AI Credential Conversation Engine - Phase 3
//  Conversation timeline per credential
//

import Foundation

/// Manages conversation timeline for credentials
public class ConversationTimeline {
    private let conversationEngine: ConversationEngine

    @Published public var timelines: [String: [TimelineEvent]] = [:]

    public init(conversationEngine: ConversationEngine = .shared) {
        self.conversationEngine = conversationEngine
    }

    /// Get timeline for a specific credential
    public func getTimeline(for credentialId: String) -> [TimelineEvent] {
        return timelines[credentialId] ?? []
    }

    /// Add event to credential timeline
    public func addEvent(
        credentialId: String,
        event: TimelineEvent
    ) {
        if timelines[credentialId] == nil {
            timelines[credentialId] = []
        }
        timelines[credentialId]?.append(event)
        timelines[credentialId]?.sort { $0.timestamp < $1.timestamp }
    }

    /// Record conversation message in timeline
    public func recordMessage(
        credentialId: String,
        message: ConversationMessage
    ) {
        let event = TimelineEvent(
            id: UUID().uuidString,
            credentialId: credentialId,
            type: .message,
            actor: message.fromActor,
            description: message.content,
            timestamp: message.timestamp,
            metadata: [
                "conversationId": message.conversationId,
                "messageType": message.messageType.rawValue
            ]
        )
        addEvent(credentialId: credentialId, event: event)
    }

    /// Record verification event
    public func recordVerification(
        credentialId: String,
        verified: Bool,
        verifier: ConversationActor,
        details: String
    ) {
        let event = TimelineEvent(
            id: UUID().uuidString,
            credentialId: credentialId,
            type: .verification,
            actor: verifier,
            description: details,
            timestamp: Date(),
            metadata: [
                "verified": String(verified),
                "verifier": verifier.rawValue
            ]
        )
        addEvent(credentialId: credentialId, event: event)
    }

    /// Record escalation event
    public func recordEscalation(
        credentialId: String,
        reason: String,
        escalatedBy: ConversationActor
    ) {
        let event = TimelineEvent(
            id: UUID().uuidString,
            credentialId: credentialId,
            type: .escalation,
            actor: escalatedBy,
            description: reason,
            timestamp: Date(),
            metadata: [
                "escalatedBy": escalatedBy.rawValue
            ]
        )
        addEvent(credentialId: credentialId, event: event)
    }
}

// MARK: - Timeline Event

public struct TimelineEvent: Identifiable, Codable, Equatable {
    let id: String
    let credentialId: String
    let type: TimelineEventType
    let actor: ConversationActor
    let description: String
    let timestamp: Date
    let metadata: [String: String]

    public init(
        id: String,
        credentialId: String,
        type: TimelineEventType,
        actor: ConversationActor,
        description: String,
        timestamp: Date,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.credentialId = credentialId
        self.type = type
        self.actor = actor
        self.description = description
        self.timestamp = timestamp
        self.metadata = metadata
    }
}

public enum TimelineEventType: String, Codable, Equatable {
    case message
    case verification
    case escalation
    case approval
    case rejection
    case conflict
    case resolution
}

