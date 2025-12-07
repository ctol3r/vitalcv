//
//  TrustLevelHapticService.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 15
//  Haptic confirmation for trust-level change
//

import UIKit

/// TrustLevelHapticService - Haptic feedback for trust level changes
public class TrustLevelHapticService {
    public static let shared = TrustLevelHapticService()

    private let impactGenerator = UIImpactFeedbackGenerator(style: .medium)
    private let notificationGenerator = UINotificationFeedbackGenerator()
    private let selectionGenerator = UISelectionFeedbackGenerator()

    private init() {
        // Prepare generators
        impactGenerator.prepare()
        notificationGenerator.prepare()
        selectionGenerator.prepare()
    }

    /// Haptic feedback for trust level increase
    public func trustLevelIncreased() {
        notificationGenerator.notificationOccurred(.success)
    }

    /// Haptic feedback for trust level decrease
    public func trustLevelDecreased() {
        notificationGenerator.notificationOccurred(.warning)
    }

    /// Haptic feedback for trust level change
    public func trustLevelChanged(from oldLevel: TrustLevel, to newLevel: TrustLevel) {
        if newLevel.rawValue > oldLevel.rawValue {
            trustLevelIncreased()
        } else if newLevel.rawValue < oldLevel.rawValue {
            trustLevelDecreased()
        } else {
            selectionGenerator.selectionChanged()
        }
    }

    /// Haptic feedback for trust verification
    public func trustVerified() {
        impactGenerator.impactOccurred()
    }

    /// Haptic feedback for trust failure
    public func trustFailed() {
        notificationGenerator.notificationOccurred(.error)
    }
}

// MARK: - Trust Level

public enum TrustLevel: Int, Comparable {
    case untrusted = 0
    case low = 1
    case medium = 2
    case high = 3
    case verified = 4

    public static func < (lhs: TrustLevel, rhs: TrustLevel) -> Bool {
        return lhs.rawValue < rhs.rawValue
    }

    public var description: String {
        switch self {
        case .untrusted: return "Untrusted"
        case .low: return "Low Trust"
        case .medium: return "Medium Trust"
        case .high: return "High Trust"
        case .verified: return "Verified"
        }
    }
}

