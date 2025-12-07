//
//  ClipHapticFeedback.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 4 - Tasks 33, 34
//  Haptic feedback for App Clip
//

import UIKit

class HapticFeedback {
    static let shared = HapticFeedback()

    private init() {}

    enum FeedbackType {
        case success
        case warning
        case error
        case impact(style: UIImpactFeedbackGenerator.FeedbackStyle)
    }

    func play(_ type: FeedbackType) {
        switch type {
        case .success:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        case .warning:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.warning)
        case .error:
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
        case .impact(let style):
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.impactOccurred()
        }
    }
}




