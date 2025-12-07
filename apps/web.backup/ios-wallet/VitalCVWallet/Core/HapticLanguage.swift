//
//  HapticLanguage.swift
//  VitalCVWallet
//
//  Created: Notifications 2.0 - Phase 2
//  Dictionary of feedback patterns - emotional grammar of trust on iOS
//

import UIKit

/// HapticLanguage - Emotional grammar of trust on iOS
/// Defines haptic patterns for different trust and notification events
public struct HapticLanguage {

    // MARK: - Trust Patterns

    /// Strong trust haptic - success, anchored
    /// Pattern: Double success with strong impact
    public static func trustHapticStrong() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()

        // First success
        generator.notificationOccurred(.success)

        // Strong impact after short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            let impactGenerator = UIImpactFeedbackGenerator(style: .heavy)
            impactGenerator.prepare()
            impactGenerator.impactOccurred()
        }
    }

    /// Soft trust haptic - minor improvement
    /// Pattern: Light success with gentle tap
    public static func trustHapticSoft() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            let impactGenerator = UIImpactFeedbackGenerator(style: .light)
            impactGenerator.prepare()
            impactGenerator.impactOccurred()
        }
    }

    // MARK: - Warning Patterns

    /// Low warning haptic - gentle rumble
    /// Pattern: Warning notification with soft impact
    public static func warningHapticLow() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.warning)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            let impactGenerator = UIImpactFeedbackGenerator(style: .soft)
            impactGenerator.prepare()
            impactGenerator.impactOccurred()
        }
    }

    /// Sharp danger haptic - rapid double-press
    /// Pattern: Error followed immediately by heavy impact
    public static func dangerHapticSharp() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.error)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            let impactGenerator = UIImpactFeedbackGenerator(style: .heavy)
            impactGenerator.prepare()
            impactGenerator.impactOccurred()
        }
    }

    // MARK: - Anchor Patterns

    /// Anchor drop haptic - single deep thump
    /// Pattern: Heavy impact with slight sustain
    public static func anchorDropHaptic() {
        let impactGenerator = UIImpactFeedbackGenerator(style: .heavy)
        impactGenerator.prepare()
        impactGenerator.impactOccurred(intensity: 1.0)
    }

    // MARK: - Message Patterns

    /// Message ping haptic - tiny tap
    /// Pattern: Very light selection feedback
    public static func messagePingHaptic() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    // MARK: - Combined Patterns

    /// Combined sound + haptic for major events
    /// Synchronizes haptic with sound playback
    public static func combinedCue(
        hapticType: HapticType,
        delay: TimeInterval = 0.0
    ) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            switch hapticType {
            case .trustStrong:
                trustHapticStrong()
            case .trustSoft:
                trustHapticSoft()
            case .warningLow:
                warningHapticLow()
            case .dangerSharp:
                dangerHapticSharp()
            case .anchorDrop:
                anchorDropHaptic()
            case .messagePing:
                messagePingHaptic()
            }
        }
    }

    // MARK: - Haptic Types

    public enum HapticType {
        case trustStrong
        case trustSoft
        case warningLow
        case dangerSharp
        case anchorDrop
        case messagePing
    }

    // MARK: - Pattern Dictionary

    /// Dictionary mapping event types to haptic patterns
    public static let patternDictionary: [String: HapticType] = [
        "credentialUpdated": .trustSoft,
        "credentialExpiring": .warningLow,
        "chainAnchorConfirmed": .anchorDrop,
        "recruiterViewed": .messagePing,
        "jobMatchFound": .trustStrong,
        "newCredentialIssued": .trustStrong,
        "verificationSuccess": .trustStrong,
        "verificationWarning": .warningLow,
        "verificationFailure": .dangerSharp,
        "complianceChange": .warningLow,
        "proofVerified": .trustStrong
    ]

    /// Get haptic type for an event
    public static func hapticType(for event: String) -> HapticType? {
        return patternDictionary[event]
    }
}

// MARK: - Enhanced HapticFeedback Integration

extension HapticFeedback {

    /// Play haptic using HapticLanguage patterns
    public func playLanguagePattern(_ type: HapticLanguage.HapticType) {
        switch type {
        case .trustStrong:
            HapticLanguage.trustHapticStrong()
        case .trustSoft:
            HapticLanguage.trustHapticSoft()
        case .warningLow:
            HapticLanguage.warningHapticLow()
        case .dangerSharp:
            HapticLanguage.dangerHapticSharp()
        case .anchorDrop:
            HapticLanguage.anchorDropHaptic()
        case .messagePing:
            HapticLanguage.messagePingHaptic()
        }
    }
}








