//
//  TrustEventBus.swift
//  VitalCVWallet
//
//  Created: Batch 138-A - Task 2
//  Cross-screen trust updates event bus
//

import Foundation
import SwiftUI
import Combine

/// TrustEventBus - Centralized event bus for trust-related updates across screens
@MainActor
public class TrustEventBus: ObservableObject {
    public static let shared = TrustEventBus()

    // MARK: - Published State

    /// Recent trust events
    @Published public var recentEvents: [TrustEvent] = []

    /// Active trust updates
    @Published public var activeUpdates: [String: TrustUpdate] = [:]

    // MARK: - Event Publishers

    /// Publisher for trust score changes
    public let trustScoreChanged = PassthroughSubject<TrustScoreChange, Never>()

    /// Publisher for chain anchor updates
    public let chainAnchorUpdated = PassthroughSubject<ChainAnchorUpdate, Never>()

    /// Publisher for verification events
    public let verificationEvent = PassthroughSubject<VerificationEvent, Never>()

    /// Publisher for credential trust changes
    public let credentialTrustChanged = PassthroughSubject<CredentialTrustChange, Never>()

    // MARK: - Private State

    private var cancellables = Set<AnyCancellable>()
    private let maxRecentEvents = 100

    // MARK: - Initialization

    private init() {
        setupSubscriptions()
    }

    // MARK: - Public API

    /// Post a trust event
    public func postEvent(_ event: TrustEvent) {
        recentEvents.insert(event, at: 0)

        // Keep only recent events
        if recentEvents.count > maxRecentEvents {
            recentEvents = Array(recentEvents.prefix(maxRecentEvents))
        }

        // Publish to appropriate publisher
        switch event.type {
        case .trustScoreChanged:
            if let change = event.payload as? TrustScoreChange {
                trustScoreChanged.send(change)
            }
        case .chainAnchorUpdated:
            if let update = event.payload as? ChainAnchorUpdate {
                chainAnchorUpdated.send(update)
            }
        case .verificationCompleted:
            if let verification = event.payload as? VerificationEvent {
                verificationEvent.send(verification)
            }
        case .credentialTrustChanged:
            if let change = event.payload as? CredentialTrustChange {
                credentialTrustChanged.send(change)
            }
        }

        // Notify via NotificationCenter for non-Combine observers
        NotificationCenter.default.post(
            name: .trustEventDidOccur,
            object: nil,
            userInfo: ["event": event]
        )
    }

    /// Update trust for a credential
    public func updateTrust(
        credentialId: String,
        score: Double,
        source: TrustSource,
        metadata: [String: Any]? = nil
    ) {
        let update = TrustUpdate(
            credentialId: credentialId,
            score: score,
            source: source,
            timestamp: Date(),
            metadata: metadata
        )

        activeUpdates[credentialId] = update

        let change = TrustScoreChange(
            credentialId: credentialId,
            oldScore: activeUpdates[credentialId]?.score ?? 0.0,
            newScore: score,
            source: source
        )

        postEvent(TrustEvent(
            type: .trustScoreChanged,
            credentialId: credentialId,
            timestamp: Date(),
            payload: change
        ))
    }

    /// Notify chain anchor update
    public func notifyChainAnchorUpdate(
        credentialId: String,
        anchorId: String,
        status: ChainAnchorStatus,
        blockNumber: UInt64?
    ) {
        let update = ChainAnchorUpdate(
            credentialId: credentialId,
            anchorId: anchorId,
            status: status,
            blockNumber: blockNumber,
            timestamp: Date()
        )

        postEvent(TrustEvent(
            type: .chainAnchorUpdated,
            credentialId: credentialId,
            timestamp: Date(),
            payload: update
        ))
    }

    /// Notify verification completion
    public func notifyVerification(
        credentialId: String,
        verified: Bool,
        trustScore: Double,
        verifier: String?
    ) {
        let verification = VerificationEvent(
            credentialId: credentialId,
            verified: verified,
            trustScore: trustScore,
            verifier: verifier,
            timestamp: Date()
        )

        postEvent(TrustEvent(
            type: .verificationCompleted,
            credentialId: credentialId,
            timestamp: Date(),
            payload: verification
        ))
    }

    /// Subscribe to trust events for a credential
    public func subscribeToCredential(
        _ credentialId: String,
        handler: @escaping (TrustEvent) -> Void
    ) -> AnyCancellable {
        return NotificationCenter.default.publisher(for: .trustEventDidOccur)
            .compactMap { notification -> TrustEvent? in
                guard let event = notification.userInfo?["event"] as? TrustEvent,
                      event.credentialId == credentialId else {
                    return nil
                }
                return event
            }
            .sink(receiveValue: handler)
    }

    /// Clear old events
    public func clearOldEvents(olderThan interval: TimeInterval) {
        let cutoff = Date().addingTimeInterval(-interval)
        recentEvents.removeAll { $0.timestamp < cutoff }
    }

    // MARK: - Private Methods

    private func setupSubscriptions() {
        // Auto-clear old events every hour
        Timer.publish(every: 3600, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.clearOldEvents(olderThan: 86400) // 24 hours
            }
            .store(in: &cancellables)
    }
}

// MARK: - Supporting Types

public struct TrustEvent: Identifiable, Codable {
    public let id = UUID()
    public let type: TrustEventType
    public let credentialId: String
    public let timestamp: Date
    public let payload: TrustEventPayload?

    public init(type: TrustEventType, credentialId: String, timestamp: Date, payload: TrustEventPayload?) {
        self.type = type
        self.credentialId = credentialId
        self.timestamp = timestamp
        self.payload = payload
    }
}

public enum TrustEventType: String, Codable {
    case trustScoreChanged
    case chainAnchorUpdated
    case verificationCompleted
    case credentialTrustChanged
    case issuerVerified
    case anchorConfirmed
}

public protocol TrustEventPayload: Codable {}

public struct TrustScoreChange: TrustEventPayload {
    public let credentialId: String
    public let oldScore: Double
    public let newScore: Double
    public let source: TrustSource
    public let delta: Double

    public init(credentialId: String, oldScore: Double, newScore: Double, source: TrustSource) {
        self.credentialId = credentialId
        self.oldScore = oldScore
        self.newScore = newScore
        self.source = source
        self.delta = newScore - oldScore
    }
}

public struct ChainAnchorUpdate: TrustEventPayload {
    public let credentialId: String
    public let anchorId: String
    public let status: ChainAnchorStatus
    public let blockNumber: UInt64?
    public let timestamp: Date
}

public struct VerificationEvent: TrustEventPayload {
    public let credentialId: String
    public let verified: Bool
    public let trustScore: Double
    public let verifier: String?
    public let timestamp: Date
}

public struct CredentialTrustChange: TrustEventPayload {
    public let credentialId: String
    public let changeType: TrustChangeType
    public let timestamp: Date
}

public enum TrustChangeType: String, Codable {
    case scoreUpdated
    case anchorConfirmed
    case issuerVerified
    case revoked
    case expired
}

public enum TrustSource: String, Codable {
    case chainAnchor
    case issuerVerification
    case verification
    case manual
    case system
}

public struct TrustUpdate {
    public let credentialId: String
    public let score: Double
    public let source: TrustSource
    public let timestamp: Date
    public let metadata: [String: Any]?
}

// MARK: - Notification Names

extension Notification.Name {
    static let trustEventDidOccur = Notification.Name("trustEventDidOccur")
}




