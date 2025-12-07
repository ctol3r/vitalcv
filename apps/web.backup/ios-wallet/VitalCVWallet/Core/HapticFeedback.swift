//
//  HapticFeedback.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 26
//  Haptic feedback across key actions
//

import UIKit

class HapticFeedback {
    static let shared = HapticFeedback()

    private init() {}

    enum FeedbackType {
        case success
        case error
        case warning
        case selection
        case impact(style: UIImpactFeedbackGenerator.FeedbackStyle)
        // Phase 5 - Task 38: Trust haptic patterns
        case trustGained
        case trustLost
        case verifiedStrong
        case verifiedWeak

        // Notifications 2.0 - Enhanced haptic language
        case trustHapticStrong
        case trustHapticSoft
        case warningHapticLow
        case dangerHapticSharp
        case anchorDropHaptic
        case messagePingHaptic
    }

    func play(_ type: FeedbackType) {
        switch type {
        case .success:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

        case .error:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)

        case .warning:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.warning)

        case .selection:
            let generator = UISelectionFeedbackGenerator()
            generator.selectionChanged()

        case .impact(let style):
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.impactOccurred()

        // Phase 5 - Task 38: Trust haptic patterns
        case .trustGained:
            // Double success pattern
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                generator.notificationOccurred(.success)
            }

        case .trustLost:
            // Error followed by warning
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                generator.notificationOccurred(.warning)
            }

        case .verifiedStrong:
            // Strong impact pattern
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.impactOccurred()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                generator.impactOccurred()
            }

        case .verifiedWeak:
            // Light impact pattern
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()

        // Notifications 2.0 - Enhanced patterns
        case .trustHapticStrong:
            HapticLanguage.trustHapticStrong()
        case .trustHapticSoft:
            HapticLanguage.trustHapticSoft()
        case .warningHapticLow:
            HapticLanguage.warningHapticLow()
        case .dangerHapticSharp:
            HapticLanguage.dangerHapticSharp()
        case .anchorDropHaptic:
            HapticLanguage.anchorDropHaptic()
        case .messagePingHaptic:
            HapticLanguage.messagePingHaptic()
        }
    }

    static func play(_ type: FeedbackType) {
        shared.play(type)
    }
}

extension View {
    func hapticFeedback(_ type: HapticFeedback, onTap: Bool = true) -> some View {
        self.onTapGesture {
            if onTap {
                HapticFeedback.play(type)
            }
        }
    }
}

