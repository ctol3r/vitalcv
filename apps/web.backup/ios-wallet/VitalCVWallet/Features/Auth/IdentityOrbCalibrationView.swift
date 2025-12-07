//
//  IdentityOrbCalibrationView.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 6
//  Identity-orb calibration animation
//

import SwiftUI

/// IdentityOrbCalibrationView - Calibration animation for identity orb
/// Provides visual feedback during identity setup and calibration
struct IdentityOrbCalibrationView: View {
    @State private var calibrationProgress: Double = 0.0
    @State private var isCalibrating = false
    @State private var calibrationPhase: CalibrationPhase = .initializing
    @State private var orbRotation: Double = 0
    @State private var orbScale: CGFloat = 1.0

    let onCalibrationComplete: () -> Void

    var body: some View {
        ZStack {
            // Background gradient
            RadialGradient(
                colors: [
                    Color.walletPrimary.opacity(0.1),
                    Color.walletBackground
                ],
                center: .center,
                startRadius: 50,
                endRadius: 200
            )
            .ignoresSafeArea()

            VStack(spacing: 40) {
                // Calibrated Orb
                ZStack {
                    // Outer ring (calibration indicator)
                    Circle()
                        .stroke(
                            Color.walletPrimary.opacity(0.3),
                            lineWidth: 4
                        )
                        .frame(width: 200, height: 200)

                    // Progress ring
                    Circle()
                        .trim(from: 0, to: calibrationProgress)
                        .stroke(
                            Color.walletPrimary,
                            style: StrokeStyle(lineWidth: 6, lineCap: .round)
                        )
                        .frame(width: 200, height: 200)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut(duration: 0.3), value: calibrationProgress)

                    // Orb
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color.walletPrimary.opacity(0.9),
                                    Color.walletPrimary.opacity(0.5),
                                    Color.walletPrimary.opacity(0.2)
                                ],
                                center: .center,
                                startRadius: 20,
                                endRadius: 80
                            )
                        )
                        .frame(width: 160, height: 160)
                        .scaleEffect(orbScale)
                        .rotationEffect(.degrees(orbRotation))
                        .overlay(
                            // Calibration indicator
                            Circle()
                                .fill(Color.white.opacity(0.3))
                                .frame(width: 20, height: 20)
                                .offset(x: 70, y: 0)
                                .rotationEffect(.degrees(orbRotation))
                        )

                    // Phase indicator
                    Text(calibrationPhase.emoji)
                        .font(.system(size: 40))
                        .foregroundColor(.white)
                }

                // Status text
                VStack(spacing: 12) {
                    Text(calibrationPhase.title)
                        .font(WalletTypography.title2)
                        .foregroundColor(.walletTextPrimary)

                    Text(calibrationPhase.description)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)

                    // Progress percentage
                    Text("\(Int(calibrationProgress * 100))%")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletPrimary)
                        .padding(.top, 8)
                }
            }
        }
        .onAppear {
            startCalibration()
        }
    }

    private func startCalibration() {
        isCalibrating = true

        // Phase 1: Initializing (0-20%)
        calibrationPhase = .initializing
        animateProgress(to: 0.2, duration: 1.0) {
            // Phase 2: Connecting (20-50%)
            calibrationPhase = .connecting
            animateProgress(to: 0.5, duration: 1.5) {
                // Phase 3: Validating (50-80%)
                calibrationPhase = .validating
                animateProgress(to: 0.8, duration: 1.5) {
                    // Phase 4: Completing (80-100%)
                    calibrationPhase = .completing
                    animateProgress(to: 1.0, duration: 1.0) {
                        calibrationPhase = .complete
                        isCalibrating = false

                        // Completion animation
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                            orbScale = 1.2
                        }

                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            onCalibrationComplete()
                        }
                    }
                }
            }
        }

        // Continuous rotation during calibration
        withAnimation(.linear(duration: 3.0).repeatForever(autoreverses: false)) {
            orbRotation = 360
        }
    }

    private func animateProgress(to value: Double, duration: Double, completion: @escaping () -> Void) {
        withAnimation(.easeInOut(duration: duration)) {
            calibrationProgress = value
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            completion()
        }
    }
}

enum CalibrationPhase {
    case initializing
    case connecting
    case validating
    case completing
    case complete

    var emoji: String {
        switch self {
        case .initializing:
            return "⚙️"
        case .connecting:
            return "🔗"
        case .validating:
            return "✓"
        case .completing:
            return "✨"
        case .complete:
            return "✅"
        }
    }

    var title: String {
        switch self {
        case .initializing:
            return "Initializing Identity"
        case .connecting:
            return "Connecting to Network"
        case .validating:
            return "Validating Credentials"
        case .completing:
            return "Finalizing Setup"
        case .complete:
            return "Calibration Complete"
        }
    }

    var description: String {
        switch self {
        case .initializing:
            return "Setting up your digital identity orb..."
        case .connecting:
            return "Establishing secure connections..."
        case .validating:
            return "Verifying your credentials..."
        case .completing:
            return "Almost ready..."
        case .complete:
            return "Your identity is calibrated and ready!"
        }
    }
}

#Preview {
    IdentityOrbCalibrationView {
        print("Calibration complete")
    }
}

