//
//  TrustHapticEngine.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 6
//  Predefined haptic signatures for trust interactions
//

import UIKit

/// TrustHapticEngine - Specialized haptic feedback for trust states
class TrustHapticEngine {
    static let shared = TrustHapticEngine()

    private init() {}

    // MARK: - Trust State Haptics

    /// Haptic for verification starting
    func verificationStarted() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Haptic for verification step completion
    func stepCompleted() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    /// Haptic for verification success
    func verificationSuccess() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)

        // Double pulse for emphasis
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            generator.notificationOccurred(.success)
        }
    }

    /// Haptic for verification warning
    func verificationWarning() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.warning)
    }

    /// Haptic for verification failure
    func verificationFailure() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.error)
    }

    // MARK: - Trust Score Haptics

    /// Haptic for trust score increase
    func trustScoreIncreased() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Haptic for trust score decrease
    func trustScoreDecreased() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()
    }

    // MARK: - Chain Haptics

    /// Haptic for chain anchor success
    func chainAnchorSuccess() {
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.prepare()
        generator.impactOccurred()

        // Rapid sequence
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            generator.impactOccurred()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            generator.impactOccurred()
        }
    }

    /// Haptic for chain confirmation
    func chainConfirmed() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    // MARK: - Proof Haptics

    /// Haptic for proof verified
    func proofVerified() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
    }

    /// Haptic for rapid proof sequence
    func rapidProofSequence(count: Int) {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()

        for i in 0..<count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.08) {
                generator.impactOccurred()
            }
        }
    }

    // MARK: - Compliance Haptics

    /// Haptic for compliance check passed
    func compliancePassed() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
    }

    // MARK: - Trust Glow Haptics

    /// Haptic for trust glow intensity change
    func trustGlowChange(intensity: Double) {
        if intensity > 0.7 {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred()
        }
    }
}

extension HapticFeedback {
    /// Convenience method to use TrustHapticEngine
    static func trust(_ action: TrustHapticAction) {
        switch action {
        case .verificationStarted:
            TrustHapticEngine.shared.verificationStarted()
        case .stepCompleted:
            TrustHapticEngine.shared.stepCompleted()
        case .verificationSuccess:
            TrustHapticEngine.shared.verificationSuccess()
        case .verificationWarning:
            TrustHapticEngine.shared.verificationWarning()
        case .verificationFailure:
            TrustHapticEngine.shared.verificationFailure()
        case .trustScoreIncreased:
            TrustHapticEngine.shared.trustScoreIncreased()
        case .trustScoreDecreased:
            TrustHapticEngine.shared.trustScoreDecreased()
        case .chainAnchorSuccess:
            TrustHapticEngine.shared.chainAnchorSuccess()
        case .chainConfirmed:
            TrustHapticEngine.shared.chainConfirmed()
        case .proofVerified:
            TrustHapticEngine.shared.proofVerified()
        case .rapidProofSequence(let count):
            TrustHapticEngine.shared.rapidProofSequence(count: count)
        case .compliancePassed:
            TrustHapticEngine.shared.compliancePassed()
        case .trustGlowChange(let intensity):
            TrustHapticEngine.shared.trustGlowChange(intensity: intensity)
        }
    }
}

enum TrustHapticAction {
    case verificationStarted
    case stepCompleted
    case verificationSuccess
    case verificationWarning
    case verificationFailure
    case trustScoreIncreased
    case trustScoreDecreased
    case chainAnchorSuccess
    case chainConfirmed
    case proofVerified
    case rapidProofSequence(count: Int)
    case compliancePassed
    case trustGlowChange(intensity: Double)
}

