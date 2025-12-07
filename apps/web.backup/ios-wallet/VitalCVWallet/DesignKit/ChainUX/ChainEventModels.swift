//
//  ChainEventModels.swift
//  VitalCVWallet
//
//  Created: Phase 2 - Supporting Models
//  Data models for chain events and anchor history
//

import Foundation

/// ChainEvent - Represents a single chain event in the timeline
public struct ChainEvent: Identifiable, Codable, Equatable {
    public let id: String
    public let type: ChainEventType
    public let timestamp: Date
    public let blockNumber: UInt64?
    public let transactionHash: String?
    public let confirmations: Int
    public let status: ChainStatus
    public let metadata: ChainEventMetadata?

    public init(
        id: String = UUID().uuidString,
        type: ChainEventType,
        timestamp: Date,
        blockNumber: UInt64? = nil,
        transactionHash: String? = nil,
        confirmations: Int = 0,
        status: ChainStatus,
        metadata: ChainEventMetadata? = nil
    ) {
        self.id = id
        self.type = type
        self.timestamp = timestamp
        self.blockNumber = blockNumber
        self.transactionHash = transactionHash
        self.confirmations = confirmations
        self.status = status
        self.metadata = metadata
    }
}

/// ChainEventMetadata - Additional metadata for chain events
public struct ChainEventMetadata: Codable, Equatable {
    public let ledgerId: String?
    public let explorerUrl: String?
    public let previousBlockNumber: UInt64?
    public let anchorAge: TimeInterval?

    public init(
        ledgerId: String? = nil,
        explorerUrl: String? = nil,
        previousBlockNumber: UInt64? = nil,
        anchorAge: TimeInterval? = nil
    ) {
        self.ledgerId = ledgerId
        self.explorerUrl = explorerUrl
        self.previousBlockNumber = previousBlockNumber
        self.anchorAge = anchorAge
    }
}

/// ChainAnchor - Represents a blockchain anchor
public struct ChainAnchor: Identifiable, Codable, Equatable {
    public let id: String
    public let credentialId: String
    public let blockNumber: UInt64
    public let transactionHash: String
    public let timestamp: Date
    public let confirmations: Int
    public let status: ChainStatus
    public let ledgerId: String?
    public let explorerUrl: String?

    public init(
        id: String = UUID().uuidString,
        credentialId: String,
        blockNumber: UInt64,
        transactionHash: String,
        timestamp: Date,
        confirmations: Int = 0,
        status: ChainStatus,
        ledgerId: String? = nil,
        explorerUrl: String? = nil
    ) {
        self.id = id
        self.credentialId = credentialId
        self.blockNumber = blockNumber
        self.transactionHash = transactionHash
        self.timestamp = timestamp
        self.confirmations = confirmations
        self.status = status
        self.ledgerId = ledgerId
        self.explorerUrl = explorerUrl
    }

    public var isStale: Bool {
        let daysSinceAnchor = Calendar.current.dateComponents([.day], from: timestamp, to: Date()).day ?? 0
        return daysSinceAnchor > 90
    }

    public var daysSinceAnchor: Int {
        Calendar.current.dateComponents([.day], from: timestamp, to: Date()).day ?? 0
    }
}

/// ChainEventGroup - Groups related chain events
public enum ChainEventGroup {
    case issued      // Credential issued
    case anchored    // First anchor
    case verified    // Verification event
    case reAnchored  // Re-anchor event
    case revoked     // Revocation event

    var displayName: String {
        switch self {
        case .issued: return "Issued"
        case .anchored: return "Anchored"
        case .verified: return "Verified"
        case .reAnchored: return "Re-anchored"
        case .revoked: return "Revoked"
        }
    }

    var priority: Int {
        switch self {
        case .issued: return 1
        case .anchored: return 5
        case .verified: return 4
        case .reAnchored: return 3
        case .revoked: return 2
        }
    }
}

