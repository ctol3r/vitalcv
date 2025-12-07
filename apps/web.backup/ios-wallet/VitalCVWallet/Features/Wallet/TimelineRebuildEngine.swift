//
//  TimelineRebuildEngine.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 17
//  Timeline rebuild engine (fast diff)
//

import Foundation

/// TimelineRebuildEngine - Fast diff-based timeline rebuilding
public class TimelineRebuildEngine {
    public static let shared = TimelineRebuildEngine()

    private init() {}

    /// Rebuild timeline with fast diff algorithm
    public func rebuildTimeline(
        oldEvents: [TimelineEvent],
        newEvents: [TimelineEvent]
    ) -> TimelineDiff {
        // Fast diff using longest common subsequence
        let diff = computeDiff(old: oldEvents, new: newEvents)

        return TimelineDiff(
            added: diff.added,
            removed: diff.removed,
            modified: diff.modified,
            unchanged: diff.unchanged
        )
    }

    /// Compute diff between two event arrays
    private func computeDiff(
        old: [TimelineEvent],
        new: [TimelineEvent]
    ) -> (added: [TimelineEvent], removed: [TimelineEvent], modified: [TimelineEvent], unchanged: [TimelineEvent]) {
        var added: [TimelineEvent] = []
        var removed: [TimelineEvent] = []
        var modified: [TimelineEvent] = []
        var unchanged: [TimelineEvent] = []

        // Create index maps for fast lookup
        let oldMap = Dictionary(uniqueKeysWithValues: old.map { ($0.id, $0) })
        let newMap = Dictionary(uniqueKeysWithValues: new.map { ($0.id, $0) })

        // Find added and modified
        for newEvent in new {
            if let oldEvent = oldMap[newEvent.id] {
                if oldEvent != newEvent {
                    modified.append(newEvent)
                } else {
                    unchanged.append(newEvent)
                }
            } else {
                added.append(newEvent)
            }
        }

        // Find removed
        for oldEvent in old {
            if newMap[oldEvent.id] == nil {
                removed.append(oldEvent)
            }
        }

        return (added, removed, modified, unchanged)
    }

    /// Merge timelines efficiently
    public func mergeTimelines(_ timelines: [TimelineEvent]...) -> [TimelineEvent] {
        var merged: [TimelineEvent] = []
        var seenIds = Set<String>()

        for timeline in timelines {
            for event in timeline {
                if !seenIds.contains(event.id) {
                    merged.append(event)
                    seenIds.insert(event.id)
                }
            }
        }

        // Sort by timestamp
        return merged.sorted { $0.timestamp > $1.timestamp }
    }
}

// MARK: - Models

public struct TimelineDiff {
    public let added: [TimelineEvent]
    public let removed: [TimelineEvent]
    public let modified: [TimelineEvent]
    public let unchanged: [TimelineEvent]

    public var hasChanges: Bool {
        return !added.isEmpty || !removed.isEmpty || !modified.isEmpty
    }
}

public struct TimelineEvent: Identifiable, Equatable, Codable {
    public let id: String
    public let type: TimelineEventType
    public let timestamp: Date
    public let title: String
    public let description: String?
    public let metadata: [String: String]?

    public init(
        id: String,
        type: TimelineEventType,
        timestamp: Date,
        title: String,
        description: String? = nil,
        metadata: [String: String]? = nil
    ) {
        self.id = id
        self.type = type
        self.timestamp = timestamp
        self.title = title
        self.description = description
        self.metadata = metadata
    }
}

public enum TimelineEventType: String, Codable {
    case issued
    case verified
    case revoked
    case updated
    case shared
    case expired
}

