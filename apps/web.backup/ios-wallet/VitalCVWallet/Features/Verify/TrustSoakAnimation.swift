//
//  TrustSoakAnimation.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 29
//  Trust soak animation while verifying
//

import SwiftUI

/// TrustSoakAnimation - Animated "soaking" effect during verification
struct TrustSoakAnimation: View {
    @Binding var isActive: Bool
    let progress: Double // 0.0 to 1.0

    @State private var wavePhase: Double = 0
    @State private var particleCount: Int = 0
    @State private var glowIntensity: Double = 0

    var body: some View {
        if isActive {
            ZStack {
                // Background gradient
                RadialGradient(
                    colors: [
                        Color.walletPrimary.opacity(0.3),
                        Color.walletBackground
                    ],
                    center: .center,
                    startRadius: 50,
                    endRadius: 200
                )
                .ignoresSafeArea()

                VStack(spacing: WalletSpacing.xl) {
                    // Main soaking circle
                    ZStack {
                        // Outer ring (soak progress)
                        Circle()
                            .stroke(
                                Color.walletPrimary.opacity(0.3),
                                lineWidth: 8
                            )
                            .frame(width: 200, height: 200)

                        // Progress ring
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(
                                AngularGradient(
                                    colors: [
                                        Color.walletPrimary,
                                        Color.walletSecondary,
                                        Color.walletPrimary
                                    ],
                                    center: .center,
                                    startAngle: .degrees(-90),
                                    endAngle: .degrees(270)
                                ),
                                style: StrokeStyle(lineWidth: 8, lineCap: .round)
                            )
                            .frame(width: 200, height: 200)
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 0.3), value: progress)

                        // Inner circle with wave effect
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        Color.walletPrimary.opacity(0.8),
                                        Color.walletPrimary.opacity(0.4),
                                        Color.walletPrimary.opacity(0.1)
                                    ],
                                    center: .center,
                                    startRadius: 30,
                                    endRadius: 80
                                )
                            )
                            .frame(width: 160, height: 160)
                            .overlay(
                                // Wave pattern
                                WavePattern(phase: wavePhase)
                                    .stroke(Color.white.opacity(0.5), lineWidth: 2)
                            )
                            .scaleEffect(1.0 + sin(wavePhase) * 0.1)
                            .shadow(
                                color: Color.walletPrimary.opacity(glowIntensity * 0.5),
                                radius: 30,
                                x: 0,
                                y: 0
                            )

                        // Center icon
                        Image(systemName: "checkmark.shield.fill")
                            .font(.system(size: 50))
                            .foregroundColor(.white)
                            .opacity(progress > 0.5 ? 1 : 0.5)
                    }

                    // Progress text
                    VStack(spacing: WalletSpacing.sm) {
                        Text("Verifying...")
                            .font(WalletTypography.title2)
                            .foregroundColor(.walletText)

                        Text("\(Int(progress * 100))%")
                            .font(WalletTypography.largeTitle)
                            .foregroundColor(.walletPrimary)
                            .bold()

                        Text(progressMessage)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                            .multilineTextAlignment(.center)
                    }

                    // Soaking particles
                    SoakingParticles(count: particleCount)
                }
            }
            .onAppear {
                startAnimation()
            }
            .onChange(of: progress) { newValue in
                updateAnimation(for: newValue)
            }
        }
    }

    private var progressMessage: String {
        if progress < 0.3 {
            return "Analyzing credential..."
        } else if progress < 0.6 {
            return "Checking chain status..."
        } else if progress < 0.9 {
            return "Validating signatures..."
        } else {
            return "Finalizing verification..."
        }
    }

    private func startAnimation() {
        // Wave animation
        withAnimation(
            Animation.linear(duration: 2.0)
                .repeatForever(autoreverses: false)
        ) {
            wavePhase = .pi * 2
        }

        // Glow pulse
        withAnimation(
            Animation.easeInOut(duration: 1.5)
                .repeatForever(autoreverses: true)
        ) {
            glowIntensity = 1.0
        }

        // Particle generation
        withAnimation(
            Animation.linear(duration: 0.5)
                .repeatForever(autoreverses: false)
        ) {
            particleCount = 20
        }
    }

    private func updateAnimation(for progress: Double) {
        // Increase particle count as progress increases
        particleCount = Int(progress * 30)

        // Haptic feedback at milestones
        if progress > 0.5 && progress < 0.51 {
            HapticFeedbackService.shared.play(.impact(.light))
        } else if progress > 0.9 && progress < 0.91 {
            HapticFeedbackService.shared.play(.success)
        }
    }
}

// MARK: - Wave Pattern

struct WavePattern: Shape {
    let phase: Double

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        let amplitude = height * 0.1
        let frequency = 3.0

        path.move(to: CGPoint(x: 0, y: height / 2))

        for x in stride(from: 0, through: width, by: 2) {
            let y = height / 2 + amplitude * sin((Double(x) / width * frequency * 2 * .pi) + phase)
            path.addLine(to: CGPoint(x: x, y: y))
        }

        return path
    }
}

// MARK: - Soaking Particles

struct SoakingParticles: View {
    let count: Int

    var body: some View {
        ZStack {
            ForEach(0..<count, id: \.self) { index in
                Circle()
                    .fill(
                        Color.walletPrimary.opacity(0.6)
                    )
                    .frame(width: 4, height: 4)
                    .offset(
                        x: cos(Double(index) * 2 * .pi / Double(count)) * 100,
                        y: sin(Double(index) * 2 * .pi / Double(count)) * 100
                    )
                    .opacity(Double.random(in: 0.3...1.0))
            }
        }
        .frame(width: 200, height: 200)
    }
}

// MARK: - Trust Soak Modifier

struct TrustSoakModifier: ViewModifier {
    @Binding var isActive: Bool
    @Binding var progress: Double

    func body(content: Content) -> some View {
        ZStack {
            content

            TrustSoakAnimation(isActive: $isActive, progress: progress)
        }
    }
}

extension View {
    /// Show trust soak animation during verification
    func trustSoakAnimation(isActive: Binding<Bool>, progress: Binding<Double>) -> some View {
        modifier(TrustSoakModifier(isActive: isActive, progress: progress))
    }
}

#Preview {
    TrustSoakAnimation(isActive: .constant(true), progress: 0.65)
}








