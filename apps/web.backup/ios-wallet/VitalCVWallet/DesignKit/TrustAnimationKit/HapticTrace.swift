//
//  HapticTrace.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 4, Task 27
//  Haptic trace for rapid step success
//

import SwiftUI

/// HapticTrace - Haptic feedback for rapid step sequences
class HapticTrace {
    static let shared = HapticTrace()

    private var traceSequence: [TraceEvent] = []
    private var isActive = false

    private init() {}

    // MARK: - Trace Events

    struct TraceEvent {
        let timestamp: Date
        let type: HapticType
        let intensity: Double

        enum HapticType {
            case light
            case medium
            case heavy
            case success
        }
    }

    // MARK: - Public Methods

    func startTrace() {
        isActive = true
        traceSequence.removeAll()
    }

    func addEvent(type: TraceEvent.HapticType, intensity: Double = 1.0) {
        guard isActive else { return }

        let event = TraceEvent(
            timestamp: Date(),
            type: type,
            intensity: intensity
        )

        traceSequence.append(event)
        playHaptic(for: event)
    }

    func endTrace() {
        isActive = false

        // Play completion haptic
        if !traceSequence.isEmpty {
            TrustHapticEngine.shared.verificationSuccess()
        }

        traceSequence.removeAll()
    }

    func playRapidSequence(count: Int, interval: TimeInterval = 0.08) {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()

        for i in 0..<count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * interval) {
                generator.impactOccurred()
            }
        }

        // Final stronger haptic
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(count) * interval) {
            TrustHapticEngine.shared.verificationSuccess()
        }
    }

    // MARK: - Private Methods

    private func playHaptic(for event: TraceEvent) {
        switch event.type {
        case .light:
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.prepare()
            generator.impactOccurred(intensity: CGFloat(event.intensity))

        case .medium:
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred(intensity: CGFloat(event.intensity))

        case .heavy:
            let generator = UIImpactFeedbackGenerator(style: .heavy)
            generator.prepare()
            generator.impactOccurred(intensity: CGFloat(event.intensity))

        case .success:
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
        }
    }
}

extension UIImpactFeedbackGenerator {
    func impactOccurred(intensity: CGFloat) {
        if #available(iOS 13.0, *) {
            let style = self.style
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.prepare()
            generator.impactOccurred(intensity: intensity)
        } else {
            self.impactOccurred()
        }
    }
}

/// RapidStepSequence - View that triggers rapid haptic sequence
struct RapidStepSequence: View {
    let steps: [String]
    @State private var currentStep: Int = 0
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<steps.count, id: \.self) { index in
                HStack {
                    Circle()
                        .fill(index <= currentStep ? Color.trustEmerald : Color.walletTextSecondary.opacity(0.3))
                        .frame(width: 12, height: 12)
                        .scaleEffect(index == currentStep ? 1.3 : 1.0)
                        .animation(TrustMotionConfig.responsiveSpring, value: currentStep)

                    Text(steps[index])
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletText)

                    Spacer()
                }
            }
        }
        .onAppear {
            startSequence()
        }
    }

    private func startSequence() {
        isAnimating = true
        HapticTrace.shared.startTrace()

        for i in 0..<steps.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.15) {
                withAnimation(TrustMotionConfig.responsiveSpring) {
                    currentStep = i
                }
                HapticTrace.shared.addEvent(type: .light)
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + Double(steps.count) * 0.15) {
            HapticTrace.shared.endTrace()
            isAnimating = false
        }
    }
}

