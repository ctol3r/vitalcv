//
//  HapticFeedbackService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 15
//  Haptic feedback for card interactions
//

import UIKit

class HapticFeedbackService {
    static let shared = HapticFeedbackService()

    private init() {}

    enum FeedbackType {
        case selection
        case impact(UIImpactFeedbackGenerator.FeedbackStyle)
        case notification(UINotificationFeedbackGenerator.FeedbackType)
        case success
        case warning
        case error
    }

    func play(_ type: FeedbackType) {
        switch type {
        case .selection:
            let generator = UISelectionFeedbackGenerator()
            generator.selectionChanged()

        case .impact(let style):
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.impactOccurred()

        case .notification(let notificationType):
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(notificationType)

        case .success:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

        case .warning:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.warning)

        case .error:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
        }
    }

    // Convenience methods for specific interactions
    func cardTapped() {
        play(.impact(.light))
    }

    func cardLongPressed() {
        play(.impact(.medium))
    }

    func verificationSuccess() {
        play(.success)
    }

    func verificationFailure() {
        play(.error)
    }

    func longPress() {
        play(.impact(.medium))
    }

    func selectionChanged() {
        play(.selection)
    }
}

