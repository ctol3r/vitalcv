//
//  ChainUXEngine.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 1
//  Chain → UI mapping engine for blockchain trust visualization
//

import SwiftUI
import Foundation
import UIKit

/// ChainUXEngine - Maps blockchain states to UI components and visual treatments
@MainActor
public class ChainUXEngine: ObservableObject {
    public static let shared = ChainUXEngine()

    // MARK: - Chain Status Mapping

    /// Maps chain status to visual treatment
    public func visualTreatment(for status: ChainStatus) -> ChainVisualTreatment {
        switch status {
        case .confirming:
            return ChainVisualTreatment(
                primaryColor: ChainColorPalette.glacialBlue,
                glowIntensity: 0.3,
                pulseEnabled: true,
                animationSpeed: 1.0
            )
        case .anchored:
            return ChainVisualTreatment(
                primaryColor: ChainColorPalette.emerald,
                glowIntensity: 0.6,
                pulseEnabled: false,
                animationSpeed: 0.0
            )
        case .stale:
            return ChainVisualTreatment(
                primaryColor: ChainColorPalette.amber,
                glowIntensity: 0.2,
                pulseEnabled: false,
                animationSpeed: 0.0
            )
        case .unverified:
            return ChainVisualTreatment(
                primaryColor: ChainColorPalette.glacialBlue.opacity(0.5),
                glowIntensity: 0.1,
                pulseEnabled: false,
                animationSpeed: 0.0
            )
        case .rejected:
            return ChainVisualTreatment(
                primaryColor: ChainColorPalette.red,
                glowIntensity: 0.4,
                pulseEnabled: false,
                animationSpeed: 0.0
            )
        }
    }

    /// Maps chain status to icon
    public func icon(for status: ChainStatus) -> String {
        switch status {
        case .confirming:
            return "hourglass"
        case .anchored:
            return "link.circle.fill"
        case .stale:
            return "exclamationmark.triangle.fill"
        case .unverified:
            return "questionmark.circle"
        case .rejected:
            return "xmark.circle.fill"
        }
    }

    /// Maps chain status to haptic action
    public func hapticAction(for status: ChainStatus) -> TrustHapticAction {
        switch status {
        case .confirming:
            return .stepCompleted
        case .anchored:
            return .chainAnchorSuccess
        case .stale:
            return .verificationWarning
        case .unverified:
            return .verificationStarted
        case .rejected:
            return .verificationFailure
        }
    }

    /// Maps confirmation count to confidence level
    public func confidenceLevel(confirmations: Int) -> ChainConfidenceLevel {
        if confirmations >= 12 {
            return .maximum
        } else if confirmations >= 6 {
            return .high
        } else if confirmations >= 3 {
            return .medium
        } else if confirmations >= 1 {
            return .low
        } else {
            return .none
        }
    }

    /// Determines if anchor is stale based on age
    public func isStale(anchorDate: Date, currentDate: Date = Date()) -> Bool {
        let daysSinceAnchor = Calendar.current.dateComponents([.day], from: anchorDate, to: currentDate).day ?? 0
        return daysSinceAnchor > 90 // 90 days threshold
    }

    /// Calculates trust score from chain data
    public func trustScore(
        status: ChainStatus,
        confirmations: Int,
        anchorAge: TimeInterval?,
        isStale: Bool
    ) -> Double {
        var score: Double = 0.0

        // Base score from status
        switch status {
        case .anchored:
            score = 0.8
        case .confirming:
            score = 0.4
        case .stale:
            score = 0.3
        case .unverified:
            score = 0.1
        case .rejected:
            score = 0.0
        }

        // Boost from confirmations
        let confirmationBoost = min(Double(confirmations) / 12.0, 0.2)
        score += confirmationBoost

        // Penalty for staleness
        if isStale {
            score *= 0.5
        }

        return min(score, 1.0)
    }
}

// MARK: - Supporting Types

/// Chain status enumeration
public enum ChainStatus: String, Codable, Equatable {
    case confirming    // Transaction pending confirmation
    case anchored      // Successfully anchored to chain
    case stale         // Anchor exists but is old
    case unverified    // Anchor status unknown
    case rejected      // Transaction rejected/failed
}

/// Visual treatment configuration
public struct ChainVisualTreatment {
    let primaryColor: Color
    let glowIntensity: Double
    let pulseEnabled: Bool
    let animationSpeed: Double
}

/// Chain confidence level
public enum ChainConfidenceLevel {
    case none
    case low
    case medium
    case high
    case maximum

    var description: String {
        switch self {
        case .none: return "Unconfirmed"
        case .low: return "Low Confidence"
        case .medium: return "Medium Confidence"
        case .high: return "High Confidence"
        case .maximum: return "Maximum Confidence"
        }
    }
}

