// LumenContext.swift

// Core environment & state snapshot

import SwiftUI
import Combine

/// High-level trust/compliance snapshot for animation drivers
struct LumenStateSnapshot {
    var trustScore: Double        // 0...100
    var riskScore: Double         // 0...100
    var complianceScore: Double   // 0...100
    var anchorFreshness: Double   // 0...1
    var hasCriticalIssues: Bool
}

/// Physics configuration for Lumen motion & layout
struct LumenPhysicsConfig {
    var orbitBaseRadius: CGFloat = 140
    var orbitRadiusVariance: CGFloat = 60
    var orbitSpringDamping: CGFloat = 0.75
    var orbitSpringStiffness: CGFloat = 120
    var jitterAmount: CGFloat = 4
}

/// Color specification for trust → light mapping
struct LumenColorSpec {
    var trustColor: Color
    var riskColor: Color
    var complianceColor: Color
}

/// Global Lumen context to inject via EnvironmentObject
final class LumenContext: ObservableObject {
    @Published var snapshot: LumenStateSnapshot
    @Published var physics: LumenPhysicsConfig
    @Published var isLowPowerMode: Bool = false

    init(snapshot: LumenStateSnapshot = .init(
        trustScore: 82,
        riskScore: 15,
        complianceScore: 90,
        anchorFreshness: 0.9,
        hasCriticalIssues: false
    ),
         physics: LumenPhysicsConfig = .init()) {
        self.snapshot = snapshot
        self.physics = physics
    }

    /// Convenience: normalized trust 0...1
    var trustNormalized: Double {
        max(0, min(1, snapshot.trustScore / 100.0))
    }

    /// Convenience: normalized risk 0...1
    var riskNormalized: Double {
        max(0, min(1, snapshot.riskScore / 100.0))
    }

    /// Trigger a global trust pulse animation (hook your animations to this later)
    func triggerTrustPulse() {
        // TODO: Publish a pulse event; observers animate accordingly
    }

    /// Trigger a chain anchor ripple event
    func triggerAnchorRipple() {
        // TODO: Publish a ripple event; observers animate accordingly
    }
}

