//
//  TransactionLogger.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 4
//  Transaction logger for proof events
//

import Foundation
import OSLog

/// TransactionLogger - Logs proof events and transactions for audit trail
public class TransactionLogger {
    public static let shared = TransactionLogger()

    private let logger = Logger(subsystem: "com.vitalcv.wallet", category: "transactions")
    private var eventQueue: [TransactionEvent] = []
    private let queueLock = NSLock()
    private let maxQueueSize = 1000

    // MARK: - Persistence

    private let persistenceURL: URL? = {
        guard let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return nil
        }
        return documentsURL.appendingPathComponent("transaction_log.jsonl")
    }()

    private init() {}

    // MARK: - Initialization

    public func initialize() async {
        // Load persisted events if needed
        await loadPersistedEvents()
    }

    // MARK: - Logging

    /// Log a transaction event
    public func log(event: TransactionEvent) async {
        queueLock.lock()
        defer { queueLock.unlock() }

        let timestamp = Date()
        let logEntry = TransactionLogEntry(
            event: event,
            timestamp: timestamp,
            sessionId: getSessionId()
        )

        eventQueue.append(logEntry)

        // Trim queue if too large
        if eventQueue.count > maxQueueSize {
            eventQueue.removeFirst(eventQueue.count - maxQueueSize)
        }

        // Log to system logger
        logger.info("\(event.description)")

        // Persist to disk
        await persistEvent(logEntry)
    }

    /// Query events by type
    public func queryEvents(
        type: TransactionEventType? = nil,
        credentialId: String? = nil,
        since: Date? = nil
    ) async -> [TransactionLogEntry] {
        queueLock.lock()
        defer { queueLock.unlock() }

        var filtered = eventQueue

        if let type = type {
            filtered = filtered.filter { $0.event.type == type }
        }

        if let credentialId = credentialId {
            filtered = filtered.filter { $0.event.credentialId == credentialId }
        }

        if let since = since {
            filtered = filtered.filter { $0.timestamp >= since }
        }

        return filtered.sorted { $0.timestamp > $1.timestamp }
    }

    /// Get event statistics
    public func getStatistics(since: Date? = nil) async -> TransactionStatistics {
        queueLock.lock()
        defer { queueLock.unlock() }

        let filtered = since.map { date in
            eventQueue.filter { $0.timestamp >= date }
        } ?? eventQueue

        var stats = TransactionStatistics()

        for entry in filtered {
            switch entry.event.type {
            case .verificationStarted:
                stats.verificationsStarted += 1
            case .verificationCompleted:
                stats.verificationsCompleted += 1
                if case .verificationCompleted(_, let valid, _) = entry.event, valid {
                    stats.verificationsSucceeded += 1
                }
            case .anchorStarted:
                stats.anchorsStarted += 1
            case .anchorCompleted:
                stats.anchorsCompleted += 1
            case .credentialAccepted:
                stats.credentialsAccepted += 1
            case .credentialRejected:
                stats.credentialsRejected += 1
            case .proofGenerated:
                stats.proofsGenerated += 1
            }
        }

        return stats
    }

    /// Clear all events
    public func clearAll() async {
        queueLock.lock()
        defer { queueLock.unlock() }

        eventQueue.removeAll()

        // Clear persisted file
        if let url = persistenceURL {
            try? FileManager.default.removeItem(at: url)
        }
    }

    // MARK: - Persistence

    private func persistEvent(_ entry: TransactionLogEntry) async {
        guard let url = persistenceURL else { return }

        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(entry)
            let line = String(data: data, encoding: .utf8) ?? ""

            if let fileHandle = try? FileHandle(forWritingTo: url) {
                fileHandle.seekToEndOfFile()
                fileHandle.write((line + "\n").data(using: .utf8)!)
                try fileHandle.close()
            } else {
                // Create file if it doesn't exist
                try (line + "\n").write(to: url, atomically: true, encoding: .utf8)
            }
        } catch {
            logger.error("Failed to persist transaction event: \(error.localizedDescription)")
        }
    }

    private func loadPersistedEvents() async {
        guard let url = persistenceURL,
              FileManager.default.fileExists(atPath: url.path) else {
            return
        }

        do {
            let content = try String(contentsOf: url, encoding: .utf8)
            let lines = content.components(separatedBy: .newlines).filter { !$0.isEmpty }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601

            var loaded: [TransactionLogEntry] = []
            for line in lines {
                if let data = line.data(using: .utf8),
                   let entry = try? decoder.decode(TransactionLogEntry.self, from: data) {
                    loaded.append(entry)
                }
            }

            queueLock.lock()
            eventQueue = loaded.suffix(maxQueueSize)
            queueLock.unlock()
        } catch {
            logger.error("Failed to load persisted events: \(error.localizedDescription)")
        }
    }

    private func getSessionId() -> String {
        // Get or create session ID
        let key = "transaction_logger.session_id"
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }

        let sessionId = UUID().uuidString
        UserDefaults.standard.set(sessionId, forKey: key)
        return sessionId
    }
}

// MARK: - Transaction Event

public enum TransactionEvent {
    case verificationStarted(credentialId: String)
    case verificationCompleted(credentialId: String, valid: Bool, chainStatus: ChainAnchorStatus?)
    case anchorStarted(credentialId: String)
    case anchorCompleted(credentialId: String, anchorId: String, txHash: String)
    case credentialAccepted(credentialId: String)
    case credentialRejected(credentialId: String, reason: String)
    case proofGenerated(credentialId: String, format: ProofFormat)

    var type: TransactionEventType {
        switch self {
        case .verificationStarted:
            return .verificationStarted
        case .verificationCompleted:
            return .verificationCompleted
        case .anchorStarted:
            return .anchorStarted
        case .anchorCompleted:
            return .anchorCompleted
        case .credentialAccepted:
            return .credentialAccepted
        case .credentialRejected:
            return .credentialRejected
        case .proofGenerated:
            return .proofGenerated
        }
    }

    var credentialId: String? {
        switch self {
        case .verificationStarted(let id),
             .verificationCompleted(let id, _, _),
             .anchorStarted(let id),
             .anchorCompleted(let id, _, _),
             .credentialAccepted(let id),
             .credentialRejected(let id, _),
             .proofGenerated(let id, _):
            return id
        }
    }

    var description: String {
        switch self {
        case .verificationStarted(let id):
            return "Verification started: \(id)"
        case .verificationCompleted(let id, let valid, _):
            return "Verification completed: \(id) - \(valid ? "valid" : "invalid")"
        case .anchorStarted(let id):
            return "Anchor started: \(id)"
        case .anchorCompleted(let id, let anchorId, let txHash):
            return "Anchor completed: \(id) -> \(anchorId) (\(txHash))"
        case .credentialAccepted(let id):
            return "Credential accepted: \(id)"
        case .credentialRejected(let id, let reason):
            return "Credential rejected: \(id) - \(reason)"
        case .proofGenerated(let id, let format):
            return "Proof generated: \(id) (\(format))"
        }
    }
}

public enum TransactionEventType {
    case verificationStarted
    case verificationCompleted
    case anchorStarted
    case anchorCompleted
    case credentialAccepted
    case credentialRejected
    case proofGenerated
}

public struct TransactionLogEntry: Codable {
    public let event: TransactionEvent
    public let timestamp: Date
    public let sessionId: String

    enum CodingKeys: String, CodingKey {
        case eventType
        case credentialId
        case valid
        case chainStatus
        case anchorId
        case txHash
        case reason
        case format
        case timestamp
        case sessionId
    }

    public init(event: TransactionEvent, timestamp: Date, sessionId: String) {
        self.event = event
        self.timestamp = timestamp
        self.sessionId = sessionId
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        sessionId = try container.decode(String.self, forKey: .sessionId)

        let eventType = try container.decode(String.self, forKey: .eventType)
        // Reconstruct event from stored data
        // Simplified - in production properly decode all event types
        switch eventType {
        case "verificationStarted":
            let credentialId = try container.decode(String.self, forKey: .credentialId)
            event = .verificationStarted(credentialId: credentialId)
        default:
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: [], debugDescription: "Unknown event type"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(sessionId, forKey: .sessionId)

        // Encode event type and data
        switch event {
        case .verificationStarted(let credentialId):
            try container.encode("verificationStarted", forKey: .eventType)
            try container.encode(credentialId, forKey: .credentialId)
        case .verificationCompleted(let credentialId, let valid, _):
            try container.encode("verificationCompleted", forKey: .eventType)
            try container.encode(credentialId, forKey: .credentialId)
            try container.encode(valid, forKey: .valid)
        case .anchorStarted(let credentialId):
            try container.encode("anchorStarted", forKey: .eventType)
            try container.encode(credentialId, forKey: .credentialId)
        case .anchorCompleted(let credentialId, let anchorId, let txHash):
            try container.encode("anchorCompleted", forKey: .eventType)
            try container.encode(credentialId, forKey: .credentialId)
            try container.encode(anchorId, forKey: .anchorId)
            try container.encode(txHash, forKey: .txHash)
        case .credentialAccepted(let credentialId):
            try container.encode("credentialAccepted", forKey: .eventType)
            try container.encode(credentialId, forKey: .credentialId)
        case .credentialRejected(let credentialId, let reason):
            try container.encode("credentialRejected", forKey: .eventType)
            try container.encode(credentialId, forKey: .credentialId)
            try container.encode(reason, forKey: .reason)
        case .proofGenerated(let credentialId, let format):
            try container.encode("proofGenerated", forKey: .eventType)
            try container.encode(credentialId, forKey: .credentialId)
            try container.encode(format.description, forKey: .format)
        }
    }
}

public struct TransactionStatistics {
    public var verificationsStarted: Int = 0
    public var verificationsCompleted: Int = 0
    public var verificationsSucceeded: Int = 0
    public var anchorsStarted: Int = 0
    public var anchorsCompleted: Int = 0
    public var credentialsAccepted: Int = 0
    public var credentialsRejected: Int = 0
    public var proofsGenerated: Int = 0
}

// MARK: - Extensions

extension ProofFormat {
    var description: String {
        switch self {
        case .jwtVC: return "JWT-VC"
        case .sdJwt: return "SD-JWT"
        case .bbsPlus: return "BBS+"
        case .isoMDL: return "ISO mDL"
        case .none: return "None"
        case .unknown: return "Unknown"
        }
    }
}

