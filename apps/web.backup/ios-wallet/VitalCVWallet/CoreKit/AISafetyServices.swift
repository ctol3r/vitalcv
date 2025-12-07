//
//  AISafetyServices.swift
//  VitalCVWallet
//
//  Created: AI Safety Layer - Phase 1, Tasks 7-8
//  Safety override management, DID binding, and event logging
//

import Foundation
import Combine

// MARK: - Safety Override Manager

/// Manages safety overrides for admins with chain logging
class SafetyOverrideManager {
    static let shared = SafetyOverrideManager()

    private var activeOverrides: [String: SafetyOverride] = [:] // userId -> Override
    private var overrideHistory: [SafetyOverrideLog] = []

    func checkOverride(userId: String, category: AICategory) async -> SafetyOverride? {
        // Check if user has active override for this category
        if let override = activeOverrides[userId],
           override.category == category || override.category == nil,
           override.expiresAt > Date() {
            // Log override usage
            await logOverrideUsage(override: override, userId: userId, category: category)
            return override
        }

        return nil
    }

    func grantOverride(
        userId: String,
        category: AICategory?,
        reason: String,
        grantedBy: String,
        duration: TimeInterval = 3600 // 1 hour default
    ) async throws {
        let override = SafetyOverride(
            userId: userId,
            category: category,
            reason: reason,
            grantedBy: grantedBy,
            expiresAt: Date().addingTimeInterval(duration)
        )

        activeOverrides[userId] = override

        // Chain anchor the override grant
        await DIDBindingService.shared.anchorOverride(
            override: override,
            grantedBy: grantedBy
        )

        // Log override grant
        let log = SafetyOverrideLog(
            override: override,
            action: .granted,
            timestamp: Date()
        )
        overrideHistory.append(log)

        // Clean up expired overrides
        cleanupExpiredOverrides()
    }

    func revokeOverride(userId: String) async {
        if let override = activeOverrides.removeValue(forKey: userId) {
            // Log revocation
            let log = SafetyOverrideLog(
                override: override,
                action: .revoked,
                timestamp: Date()
            )
            overrideHistory.append(log)

            // Chain anchor the revocation
            await DIDBindingService.shared.anchorOverrideRevocation(
                userId: userId,
                timestamp: Date()
            )
        }
    }

    func getOverrideHistory(userId: String) -> [SafetyOverrideLog] {
        return overrideHistory.filter { $0.override.userId == userId }
    }

    private func logOverrideUsage(override: SafetyOverride, userId: String, category: AICategory) async {
        let log = SafetyOverrideLog(
            override: override,
            action: .used,
            timestamp: Date()
        )
        overrideHistory.append(log)

        // Chain anchor usage
        await DIDBindingService.shared.anchorOverrideUsage(
            userId: userId,
            category: category,
            timestamp: Date()
        )
    }

    private func cleanupExpiredOverrides() {
        let now = Date()
        activeOverrides = activeOverrides.filter { $0.value.expiresAt > now }
    }
}

struct SafetyOverride {
    let userId: String
    let category: AICategory?
    let reason: String
    let grantedBy: String
    let expiresAt: Date
}

struct SafetyOverrideLog {
    let override: SafetyOverride
    let action: OverrideAction
    let timestamp: Date
}

enum OverrideAction: String, Codable {
    case granted = "granted"
    case revoked = "revoked"
    case used = "used"
}

// MARK: - DID Binding Service

/// Binds AI model decisions to DIDs for accountability
class DIDBindingService {
    static let shared = DIDBindingService()

    private let networkService = NetworkService.shared

    func anchorDecision(did: String, decision: SafetyDecision) async {
        // Create chain anchor for safety decision
        let anchorRequest = SafetyDecisionAnchorRequest(
            did: did,
            decision: decision,
            timestamp: Date()
        )

        // In production, this would call the chain anchoring service
        // For now, log to local storage
        await SafetyEventLogger.shared.logDecisionAnchor(
            did: did,
            decision: decision
        )
    }

    func anchorOverride(override: SafetyOverride, grantedBy: String) async {
        // Anchor override grant to chain
        await SafetyEventLogger.shared.logOverrideAnchor(
            override: override,
            grantedBy: grantedBy
        )
    }

    func anchorOverrideRevocation(userId: String, timestamp: Date) async {
        // Anchor override revocation to chain
        await SafetyEventLogger.shared.logOverrideRevocationAnchor(
            userId: userId,
            timestamp: timestamp
        )
    }

    func anchorOverrideUsage(userId: String, category: AICategory, timestamp: Date) async {
        // Anchor override usage to chain
        await SafetyEventLogger.shared.logOverrideUsageAnchor(
            userId: userId,
            category: category,
            timestamp: timestamp
        )
    }
}

struct SafetyDecisionAnchorRequest {
    let did: String
    let decision: SafetyDecision
    let timestamp: Date
}

// MARK: - Safety Event Logger

/// Logs all safety events with chain anchoring support
actor SafetyEventLogger {
    static let shared = SafetyEventLogger()

    private var events: [SafetyEvent] = []
    private let maxEvents = 10000 // Keep last 10k events

    private init() {}

    func log(_ event: SafetyEvent) async {
        events.append(event)

        // Maintain max size
        if events.count > maxEvents {
            events.removeFirst(events.count - maxEvents)
        }

        // Persist to storage
        await persistEvents()
    }

    func getEvents(userId: String? = nil, limit: Int = 100) async -> [SafetyEvent] {
        var filtered = events

        if let userId = userId {
            filtered = filtered.filter { $0.userId == userId }
        }

        // Sort by timestamp descending
        filtered.sort { $0.timestamp > $1.timestamp }

        return Array(filtered.prefix(limit))
    }

    func getStatistics() async -> SafetyStatistics {
        let now = Date()
        let recentEvents = events.filter { now.timeIntervalSince($0.timestamp) < 86400 * 30 } // Last 30 days

        let blockedCount = recentEvents.filter { $0.type == .blocked }.count
        let rewrittenCount = recentEvents.filter { $0.type == .rewritten }.count
        let flaggedCount = recentEvents.filter { $0.type == .flagged }.count
        let overrideCount = recentEvents.filter { $0.type == .overrideUsed }.count
        let piiDetections = recentEvents.filter { $0.type == .piiDetected }.count
        let biasDetections = recentEvents.filter { $0.type == .biasDetected }.count
        let hallucinationDetections = recentEvents.filter { $0.type == .hallucinationDetected }.count

        let biasScores = recentEvents.compactMap { $0.biasScore }
        let averageBiasScore = biasScores.isEmpty ? 0.0 : biasScores.reduce(0, +) / Double(biasScores.count)

        let hallucinationRisks = recentEvents.compactMap { $0.hallucinationRisk }
        let averageHallucinationRisk = hallucinationRisks.isEmpty ? 0.0 : hallucinationRisks.reduce(0, +) / Double(hallucinationRisks.count)

        var eventsByCategory: [String: Int] = [:]
        for event in recentEvents {
            if let category = event.category {
                let key = category.rawValue
                eventsByCategory[key, default: 0] += 1
            }
        }

        return SafetyStatistics(
            totalEvents: recentEvents.count,
            blockedCount: blockedCount,
            rewrittenCount: rewrittenCount,
            flaggedCount: flaggedCount,
            overrideCount: overrideCount,
            piiDetections: piiDetections,
            biasDetections: biasDetections,
            hallucinationDetections: hallucinationDetections,
            averageBiasScore: averageBiasScore,
            averageHallucinationRisk: averageHallucinationRisk,
            eventsByCategory: eventsByCategory,
            lastUpdated: now
        )
    }

    func logDecisionAnchor(did: String, decision: SafetyDecision) async {
        // Log chain anchor for decision
        // In production, this would store the chain transaction ID
        let event = SafetyEvent(
            type: .flagged,
            userId: did,
            did: did,
            chainAnchorId: UUID().uuidString, // In production, this would be the actual chain tx ID
            timestamp: Date()
        )
        await log(event)
    }

    func logOverrideAnchor(override: SafetyOverride, grantedBy: String) async {
        // Log chain anchor for override grant
        // Implementation would store chain transaction
    }

    func logOverrideRevocationAnchor(userId: String, timestamp: Date) async {
        // Log chain anchor for override revocation
        // Implementation would store chain transaction
    }

    func logOverrideUsageAnchor(userId: String, category: AICategory, timestamp: Date) async {
        // Log chain anchor for override usage
        // Implementation would store chain transaction
    }

    private func persistEvents() async {
        // Persist events to UserDefaults or Core Data
        // For simplicity, using UserDefaults with JSON encoding
        if let data = try? JSONEncoder().encode(Array(events.suffix(1000))) {
            UserDefaults.standard.set(data, forKey: "AISafetyEvents")
        }
    }
}

