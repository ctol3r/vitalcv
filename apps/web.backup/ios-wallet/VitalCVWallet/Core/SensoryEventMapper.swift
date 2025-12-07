//
//  SensoryEventMapper.swift
//  VitalCVWallet
//
//  Created: Notifications 2.0 - Phase 5
//  Maps backend events to sensory signatures (sight, sound, haptics)
//

import SwiftUI
import Combine

/// SensoryEventMapper - Maps backend events to multi-sensory experiences
@MainActor
public class SensoryEventMapper: ObservableObject {
    public static let shared = SensoryEventMapper()

    // MARK: - Event Types

    public enum BackendEvent: String {
        case credentialUpdated = "credentialUpdated"
        case credentialExpiring = "credentialExpiring"
        case chainAnchorConfirmed = "chainAnchorConfirmed"
        case recruiterViewed = "recruiterViewed"
        case jobMatchFound = "jobMatchFound"
        case newCredentialIssued = "newCredentialIssued"
        case verificationSuccess = "verificationSuccess"
        case verificationWarning = "verificationWarning"
        case verificationFailure = "verificationFailure"
        case complianceChange = "complianceChange"
    }

    // MARK: - Sensory Signatures

    struct SensorySignature {
        let soundType: SoundEngine.SoundType?
        let hapticType: HapticLanguage.HapticType
        let visualType: VisualNotificationType
        let color: Color
    }

    enum VisualNotificationType {
        case trustGlow
        case chainRipple
        case complianceSpark
        case proofBloom
        case staleHaze
        case recruiterPing
        case matchSparkle
        case trustEcho
    }

    // MARK: - Event Mapping

    private let eventMapping: [BackendEvent: SensorySignature] = [
        .credentialUpdated: SensorySignature(
            soundType: .trustUp,
            hapticType: .trustSoft,
            visualType: .trustGlow,
            color: .green
        ),
        .credentialExpiring: SensorySignature(
            soundType: .warning,
            hapticType: .warningLow,
            visualType: .complianceSpark,
            color: .amber
        ),
        .chainAnchorConfirmed: SensorySignature(
            soundType: .anchorConfirmed,
            hapticType: .anchorDrop,
            visualType: .chainRipple,
            color: .blue
        ),
        .recruiterViewed: SensorySignature(
            soundType: .messageReceived,
            hapticType: .messagePing,
            visualType: .recruiterPing,
            color: .blue
        ),
        .jobMatchFound: SensorySignature(
            soundType: .trustUp,
            hapticType: .trustStrong,
            visualType: .matchSparkle,
            color: .purple
        ),
        .newCredentialIssued: SensorySignature(
            soundType: .trustUp,
            hapticType: .trustStrong,
            visualType: .proofBloom,
            color: .green
        ),
        .verificationSuccess: SensorySignature(
            soundType: .trustUp,
            hapticType: .trustStrong,
            visualType: .proofBloom,
            color: .green
        ),
        .verificationWarning: SensorySignature(
            soundType: .warning,
            hapticType: .warningLow,
            visualType: .complianceSpark,
            color: .amber
        ),
        .verificationFailure: SensorySignature(
            soundType: .failure,
            hapticType: .dangerSharp,
            visualType: .complianceSpark,
            color: .red
        ),
        .complianceChange: SensorySignature(
            soundType: .warning,
            hapticType: .warningLow,
            visualType: .complianceSpark,
            color: .amber
        )
    ]

    // MARK: - State

    private var recentEvents: [String: Date] = [:]
    private let echoThreshold: TimeInterval = 5.0 // 5 seconds for trust echo

    // MARK: - Trigger Event

    /// Trigger a sensory event for a backend event
    public func triggerEvent(
        _ event: BackendEvent,
        credentialId: String? = nil,
        view: AnyView? = nil
    ) {
        guard let signature = eventMapping[event] else {
            return
        }

        // Check quiet mode
        if isQuietModeActive() {
            // Only show gentle visuals
            triggerVisualOnly(signature, view: view)
            return
        }

        // Check for trust echo (repeated strong events)
        if event == .chainAnchorConfirmed || event == .verificationSuccess {
            if shouldTriggerTrustEcho(event: event, credentialId: credentialId) {
                triggerTrustEcho(signature, view: view)
                return
            }
        }

        // Sync sound + haptics timing
        syncSensoryFeedback(signature: signature, view: view)

        // Record event for echo detection
        if let credentialId = credentialId {
            recentEvents["\(event.rawValue)_\(credentialId)"] = Date()
        }
    }

    // MARK: - Sensory Feedback

    private func syncSensoryFeedback(signature: SensorySignature, view: AnyView?) {
        let soundEngine = SoundEngine.shared
        let hapticType = signature.hapticType

        // Convert haptic type to SoundEngine haptic
        let hapticFeedback: HapticFeedback.FeedbackType = {
            switch hapticType {
            case .trustStrong:
                return .trustHapticStrong
            case .trustSoft:
                return .trustHapticSoft
            case .warningLow:
                return .warningHapticLow
            case .dangerSharp:
                return .dangerHapticSharp
            case .anchorDrop:
                return .anchorDropHaptic
            case .messagePing:
                return .messagePingHaptic
            }
        }()

        // Play sound with haptic sync
        if let soundType = signature.soundType {
            soundEngine.play(soundType, withHaptic: hapticFeedback)
        } else {
            // Haptic only
            HapticFeedback.play(hapticFeedback)
        }

        // Trigger visual feedback
        if let view = view {
            triggerVisual(signature, in: view)
        }
    }

    private func triggerVisual(_ signature: SensorySignature, in view: AnyView) {
        // Visual feedback is handled by the view modifier
        // This would be called from the view layer
    }

    private func triggerVisualOnly(_ signature: SensorySignature, view: AnyView?) {
        // Quiet mode - visual only, no sound/haptic
        // Visual feedback handled by view
    }

    private func triggerTrustEcho(_ signature: SensorySignature, view: AnyView?) {
        // Trust echo - multiple visual waves
        // Sound and haptic still play, but visual is enhanced

        // Play standard feedback
        if let soundType = signature.soundType {
            SoundEngine.shared.play(soundType, withHaptic: .trustHapticStrong)
        }

        // Visual echo handled by view
    }

    // MARK: - Quiet Mode

    private func isQuietModeActive() -> Bool {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: Date())

        // Quiet mode: 10 PM to 7 AM
        return hour >= 22 || hour < 7
    }

    // MARK: - Trust Echo Detection

    private func shouldTriggerTrustEcho(event: BackendEvent, credentialId: String?) -> Bool {
        guard let credentialId = credentialId else { return false }

        let key = "\(event.rawValue)_\(credentialId)"
        if let lastEvent = recentEvents[key] {
            let timeSince = Date().timeIntervalSince(lastEvent)
            return timeSince < echoThreshold
        }

        return false
    }

    // MARK: - Frame-Synced Timing

    /// Sync sensory feedback to frame updates
    public func syncToFrameUpdate() {
        // This would be called from a CADisplayLink or similar
        // For now, we rely on SwiftUI's animation system
    }
}

// MARK: - Visual Notification Helper

struct VisualNotificationHelper {
    static func createVisual(for type: SensoryEventMapper.VisualNotificationType) -> AnyView {
        switch type {
        case .trustGlow:
            return AnyView(TrustGlowNotification())
        case .chainRipple:
            return AnyView(ChainRippleNotification())
        case .complianceSpark:
            return AnyView(ComplianceSparkNotification())
        case .proofBloom:
            return AnyView(ProofBloomBurst())
        case .staleHaze:
            return AnyView(StaleAnchorHaze())
        case .recruiterPing:
            return AnyView(RecruiterViewPing())
        case .matchSparkle:
            return AnyView(MatchScoreSparkle())
        case .trustEcho:
            return AnyView(TrustEchoAnimation())
        }
    }
}

