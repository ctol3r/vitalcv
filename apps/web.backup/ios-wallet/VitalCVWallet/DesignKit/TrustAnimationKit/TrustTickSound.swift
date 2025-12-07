//
//  TrustTickSound.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 26
//  Soft, subtle, optional trust tick sound
//

import AVFoundation
import SwiftUI

/// TrustTickSound - Subtle sound feedback for trust actions
class TrustTickSound {
    static let shared = TrustTickSound()

    private var audioPlayer: AVAudioPlayer?
    private var isEnabled = true
    private let volume: Float = 0.3 // Subtle volume

    private init() {
        setupAudioSession()
    }

    // MARK: - Configuration

    func enable() {
        isEnabled = true
    }

    func disable() {
        isEnabled = false
    }

    // MARK: - Sound Methods

    func playTick() {
        guard isEnabled else { return }
        playSystemSound(note: .tick)
    }

    func playSuccess() {
        guard isEnabled else { return }
        playSystemSound(note: .success)
    }

    func playStep() {
        guard isEnabled else { return }
        playSystemSound(note: .step)
    }

    func playBloom() {
        guard isEnabled else { return }
        playSystemSound(note: .bloom)
    }

    // MARK: - Private Methods

    private enum SoundNote {
        case tick
        case success
        case step
        case bloom

        var systemSoundID: SystemSoundID {
            switch self {
            case .tick:
                return 1103 // Tink sound
            case .success:
                return 1057 // Success sound
            case .step:
                return 1054 // Pop sound
            case .bloom:
                return 1025 // Bloom sound
            }
        }
    }

    private func playSystemSound(note: SoundNote) {
        // Use system sound for subtle feedback
        AudioServicesPlaySystemSoundWithCompletion(note.systemSoundID, nil)
    }

    private func setupAudioSession() {
        // Configure audio session for subtle playback
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to setup audio session: \(error)")
        }
    }
}

/// TrustTickSoundModifier - View modifier to enable/disable sounds
struct TrustTickSoundModifier: ViewModifier {
    let isEnabled: Bool

    func body(content: Content) -> some View {
        content
            .onAppear {
                if isEnabled {
                    TrustTickSound.shared.enable()
                } else {
                    TrustTickSound.shared.disable()
                }
            }
    }
}

extension View {
    /// Enables or disables trust tick sounds
    func trustTickSound(enabled: Bool = true) -> some View {
        modifier(TrustTickSoundModifier(isEnabled: enabled))
    }
}

extension TrustHapticEngine {
    /// Plays sound along with haptic for step completion
    func stepCompletedWithSound() {
        stepCompleted()
        TrustTickSound.shared.playStep()
    }

    /// Plays sound along with haptic for success
    func verificationSuccessWithSound() {
        verificationSuccess()
        TrustTickSound.shared.playSuccess()
    }
}

