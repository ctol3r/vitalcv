//
//  SoundEngine.swift
//  VitalCVWallet
//
//  Created: Notifications 2.0 - Phase 1
//  Sound engine with Haptics + AVAudioEngine integration
//

import AVFoundation
import UIKit
import Combine

/// SoundEngine - Multi-sensory notification system with sound and haptic integration
@MainActor
public class SoundEngine: ObservableObject {
    public static let shared = SoundEngine()

    // MARK: - Published State

    @Published public var isSoundEnabled: Bool = true
    @Published public var volumeSensitivity: Double = 0.7 // 0.0 to 1.0
    @Published public var isVibrationOnlyMode: Bool = false
    @Published public var heartbeatSyncEnabled: Bool = false

    // MARK: - Private State

    private var audioEngine: AVAudioEngine?
    private var audioPlayerNodes: [AVAudioPlayerNode] = []
    private var cancellables = Set<AnyCancellable>()

    // Sound file paths (will be generated programmatically)
    private var soundBuffers: [SoundType: AVAudioPCMBuffer] = [:]

    // Haptic integration
    private let hapticEngine = HapticFeedback.shared

    // MARK: - Sound Types

    public enum SoundType: String, CaseIterable {
        case trustUp = "trust_up"
        case anchorConfirmed = "anchor_confirmed"
        case warning = "warning"
        case failure = "failure"
        case messageReceived = "message_received"
    }

    // MARK: - Initialization

    private init() {
        setupAudioEngine()
        loadUserPreferences()
    }

    // MARK: - Audio Engine Setup

    private func setupAudioEngine() {
        do {
            let engine = AVAudioEngine()
            let audioSession = AVAudioSession.sharedInstance()

            try audioSession.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)

            self.audioEngine = engine

            // Generate sound buffers programmatically
            generateSoundBuffers()

        } catch {
            print("[SoundEngine] Failed to setup audio engine: \(error)")
        }
    }

    // MARK: - Sound Generation

    /// Generate sound buffers programmatically (no external files needed)
    private func generateSoundBuffers() {
        let sampleRate: Double = 44100
        let duration: Double = 0.5 // Base duration

        // TrustUp: Soft, warm, single-tone (C5 - 523.25 Hz)
        soundBuffers[.trustUp] = generateTone(
            frequency: 523.25,
            duration: 0.3,
            amplitude: 0.3,
            sampleRate: sampleRate,
            envelope: .softWarm
        )

        // AnchorConfirmed: Low bell (C3 - 130.81 Hz) + airy shimmer (C6 - 1046.5 Hz)
        soundBuffers[.anchorConfirmed] = generateLayeredTone(
            frequencies: [130.81, 1046.5],
            duration: 0.6,
            amplitudes: [0.4, 0.15],
            sampleRate: sampleRate,
            envelope: .bellShimmer
        )

        // Warning: Gentle amber pulse (A4 - 440 Hz with gentle modulation)
        soundBuffers[.warning] = generateModulatedTone(
            baseFrequency: 440.0,
            duration: 0.4,
            amplitude: 0.25,
            modulationRate: 3.0,
            sampleRate: sampleRate,
            envelope: .gentlePulse
        )

        // Failure: Muted, downward two-tone (C4 -> A3)
        soundBuffers[.failure] = generateTwoTone(
            frequencies: [261.63, 220.0], // C4 -> A3
            duration: 0.5,
            amplitude: 0.2,
            sampleRate: sampleRate,
            envelope: .downward
        )

        // MessageReceived: Short spark tone (E5 - 659.25 Hz, very short)
        soundBuffers[.messageReceived] = generateTone(
            frequency: 659.25,
            duration: 0.15,
            amplitude: 0.25,
            sampleRate: sampleRate,
            envelope: .spark
        )
    }

    // MARK: - Tone Generation Helpers

    private func generateTone(
        frequency: Double,
        duration: Double,
        amplitude: Double,
        sampleRate: Double,
        envelope: EnvelopeType
    ) -> AVAudioPCMBuffer? {
        let frameCount = Int(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else {
            return nil
        }

        buffer.frameLength = AVAudioFrameCount(frameCount)

        guard let channelData = buffer.floatChannelData else { return nil }
        let samples = channelData[0]

        for i in 0..<frameCount {
            let time = Double(i) / sampleRate
            let phase = 2.0 * .pi * frequency * time
            let rawSample = sin(phase)

            // Apply envelope
            let envelopeValue = applyEnvelope(envelope, time: time, duration: duration)
            samples[i] = Float(rawSample * amplitude * envelopeValue * Float(volumeSensitivity))
        }

        return buffer
    }

    private func generateLayeredTone(
        frequencies: [Double],
        duration: Double,
        amplitudes: [Double],
        sampleRate: Double,
        envelope: EnvelopeType
    ) -> AVAudioPCMBuffer? {
        let frameCount = Int(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else {
            return nil
        }

        buffer.frameLength = AVAudioFrameCount(frameCount)

        guard let channelData = buffer.floatChannelData else { return nil }
        let samples = channelData[0]

        for i in 0..<frameCount {
            let time = Double(i) / sampleRate
            var sample: Double = 0.0

            for (index, frequency) in frequencies.enumerated() {
                let phase = 2.0 * .pi * frequency * time
                let amp = amplitudes[safe: index] ?? amplitudes.last ?? 0.5
                sample += sin(phase) * amp
            }

            let envelopeValue = applyEnvelope(envelope, time: time, duration: duration)
            samples[i] = Float(sample * envelopeValue * Float(volumeSensitivity))
        }

        return buffer
    }

    private func generateModulatedTone(
        baseFrequency: Double,
        duration: Double,
        amplitude: Double,
        modulationRate: Double,
        sampleRate: Double,
        envelope: EnvelopeType
    ) -> AVAudioPCMBuffer? {
        let frameCount = Int(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else {
            return nil
        }

        buffer.frameLength = AVAudioFrameCount(frameCount)

        guard let channelData = buffer.floatChannelData else { return nil }
        let samples = channelData[0]

        for i in 0..<frameCount {
            let time = Double(i) / sampleRate
            let modulation = sin(2.0 * .pi * modulationRate * time) * 0.1 // 10% modulation
            let frequency = baseFrequency * (1.0 + modulation)
            let phase = 2.0 * .pi * frequency * time
            let rawSample = sin(phase)

            let envelopeValue = applyEnvelope(envelope, time: time, duration: duration)
            samples[i] = Float(rawSample * amplitude * envelopeValue * Float(volumeSensitivity))
        }

        return buffer
    }

    private func generateTwoTone(
        frequencies: [Double],
        duration: Double,
        amplitude: Double,
        sampleRate: Double,
        envelope: EnvelopeType
    ) -> AVAudioPCMBuffer? {
        let frameCount = Int(sampleRate * duration)
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else {
            return nil
        }

        buffer.frameLength = AVAudioFrameCount(frameCount)

        guard let channelData = buffer.floatChannelData else { return nil }
        let samples = channelData[0]

        let transitionPoint = frameCount / 2

        for i in 0..<frameCount {
            let time = Double(i) / sampleRate
            let frequency: Double

            if i < transitionPoint {
                frequency = frequencies[0]
            } else {
                // Smooth transition
                let transitionProgress = Double(i - transitionPoint) / Double(frameCount - transitionPoint)
                frequency = frequencies[0] + (frequencies[1] - frequencies[0]) * transitionProgress
            }

            let phase = 2.0 * .pi * frequency * time
            let rawSample = sin(phase)

            let envelopeValue = applyEnvelope(envelope, time: time, duration: duration)
            samples[i] = Float(rawSample * amplitude * envelopeValue * Float(volumeSensitivity))
        }

        return buffer
    }

    // MARK: - Envelope Types

    private enum EnvelopeType {
        case softWarm      // Gentle attack, slow decay
        case bellShimmer   // Bell-like attack, shimmer sustain
        case gentlePulse   // Pulsing amplitude
        case downward      // Descending amplitude
        case spark         // Quick attack, fast decay
    }

    private func applyEnvelope(_ type: EnvelopeType, time: Double, duration: Double) -> Double {
        let progress = time / duration

        switch type {
        case .softWarm:
            // Gentle attack (0.1s), slow decay
            if progress < 0.2 {
                return progress / 0.2 // Attack
            } else {
                return 1.0 - (progress - 0.2) / 0.8 * 0.7 // Decay to 30%
            }

        case .bellShimmer:
            // Quick attack, shimmer sustain
            if progress < 0.15 {
                return progress / 0.15
            } else if progress < 0.6 {
                // Shimmer: slight oscillation
                let shimmer = sin(progress * 20.0) * 0.1 + 0.9
                return shimmer
            } else {
                return (1.0 - progress) / 0.4
            }

        case .gentlePulse:
            // Pulsing throughout
            let pulse = sin(progress * 6.0 * .pi) * 0.15 + 0.85
            let fade = 1.0 - progress * 0.3
            return pulse * fade

        case .downward:
            // Descending amplitude
            return 1.0 - progress * 0.6

        case .spark:
            // Quick attack, fast decay
            if progress < 0.2 {
                return progress / 0.2
            } else {
                return (1.0 - progress) / 0.8
            }
        }
    }

    // MARK: - Playback

    /// Play a sound with optional haptic sync
    public func play(_ soundType: SoundType, withHaptic hapticType: HapticFeedback.FeedbackType? = nil) {
        guard isSoundEnabled && !isVibrationOnlyMode else {
            // If sound is off, only play haptic if provided
            if let haptic = hapticType {
                hapticEngine.play(haptic)
            }
            return
        }

        // Check silent mode
        if isDeviceInSilentMode() && !isVibrationOnlyMode {
            // Fallback to haptic only
            if let haptic = hapticType {
                hapticEngine.play(haptic)
            }
            return
        }

        guard let buffer = soundBuffers[soundType],
              let engine = audioEngine else {
            // Fallback to haptic
            if let haptic = hapticType {
                hapticEngine.play(haptic)
            }
            return
        }

        // Create player node
        let playerNode = AVAudioPlayerNode()
        engine.attach(playerNode)
        engine.connect(playerNode, to: engine.mainMixerNode, format: buffer.format)

        // Start engine if needed
        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                print("[SoundEngine] Failed to start engine: \(error)")
                if let haptic = hapticType {
                    hapticEngine.play(haptic)
                }
                return
            }
        }

        // Play sound
        playerNode.scheduleBuffer(buffer, at: nil, options: [], completionHandler: { [weak self] in
            DispatchQueue.main.async {
                self?.audioPlayerNodes.removeAll { $0 === playerNode }
                engine.detach(playerNode)
            }
        })

        playerNode.play()
        audioPlayerNodes.append(playerNode)

        // Sync haptic if provided
        if let haptic = hapticType {
            // Sync haptic to sound start
            hapticEngine.play(haptic)
        }
    }

    // MARK: - Device State

    private func isDeviceInSilentMode() -> Bool {
        // Check if device is in silent mode (ring/silent switch)
        // Note: This is an approximation - iOS doesn't provide direct API
        // We'll respect the user's preference instead
        return false // Will be enhanced with actual detection if needed
    }

    // MARK: - User Preferences

    private func loadUserPreferences() {
        // Load from UserDefaults
        isSoundEnabled = UserDefaults.standard.bool(forKey: "soundEngine.enabled")
        if !UserDefaults.standard.object(forKey: "soundEngine.enabled") != nil {
            isSoundEnabled = true // Default to enabled
        }

        volumeSensitivity = UserDefaults.standard.double(forKey: "soundEngine.volumeSensitivity")
        if volumeSensitivity == 0.0 {
            volumeSensitivity = 0.7 // Default
        }

        isVibrationOnlyMode = UserDefaults.standard.bool(forKey: "soundEngine.vibrationOnly")
        heartbeatSyncEnabled = UserDefaults.standard.bool(forKey: "soundEngine.heartbeatSync")
    }

    public func savePreferences() {
        UserDefaults.standard.set(isSoundEnabled, forKey: "soundEngine.enabled")
        UserDefaults.standard.set(volumeSensitivity, forKey: "soundEngine.volumeSensitivity")
        UserDefaults.standard.set(isVibrationOnlyMode, forKey: "soundEngine.vibrationOnly")
        UserDefaults.standard.set(heartbeatSyncEnabled, forKey: "soundEngine.heartbeatSync")
    }
}

// MARK: - Array Safe Access

private extension Array {
    subscript(safe index: Int) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}








