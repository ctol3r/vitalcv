//
//  IdentitySetupView.swift
//  VitalCVWallet
//
//  Created: Batch 551 - Task 6
//  1-screen Identity Setup using animation
//

import SwiftUI

/// Single-screen identity setup with smooth animations
struct IdentitySetupView: View {
    @StateObject private var viewModel = IdentitySetupViewModel()
    @State private var animationPhase: AnimationPhase = .initial
    @State private var orbScale: CGFloat = 0.5
    @State private var orbOpacity: Double = 0.0

    enum AnimationPhase {
        case initial
        case orbAppearing
        case orbHatching
        case formAppearing
        case complete
    }

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.2),
                    Color(red: 0.15, green: 0.15, blue: 0.25)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Identity Orb with hatching animation (Task 10)
                IdentityOrbView(
                    scale: orbScale,
                    opacity: orbOpacity,
                    isHatching: animationPhase == .orbHatching
                )
                .frame(width: 120, height: 120)
                .padding(.bottom, 40)

                // Form content
                if animationPhase >= .formAppearing {
                    VStack(spacing: 24) {
                        Text("Set Up Your Identity")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.white)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))

                        Text("Create your digital identity to start managing credentials")
                            .font(.system(size: 16))
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                            .transition(.opacity)

                        // Action buttons
                        VStack(spacing: 16) {
                            // Primary: Create Identity
                            Button(action: {
                                Task {
                                    await viewModel.createIdentity()
                                }
                            }) {
                                HStack {
                                    Image(systemName: "sparkles")
                                    Text("Create Identity")
                                }
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(
                                    LinearGradient(
                                        colors: [Color.blue, Color.purple],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .cornerRadius(12)
                            }
                            .disabled(viewModel.isCreating)

                            // Secondary: Begin with scan (Task 7)
                            Button(action: {
                                viewModel.beginWithScan()
                            }) {
                                HStack {
                                    Image(systemName: "qrcode.viewfinder")
                                    Text("Begin with a Scan")
                                }
                                .font(.system(size: 17, weight: .medium))
                                .foregroundColor(.white.opacity(0.9))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(Color.white.opacity(0.1))
                                .cornerRadius(12)
                            }

                            // Tertiary: Trial mode (Task 8)
                            Button(action: {
                                viewModel.enterTrialMode()
                            }) {
                                Text("Try Without Identity")
                                    .font(.system(size: 15))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }
                        .padding(.horizontal, 32)
                        .padding(.top, 8)
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                Spacer()
            }
        }
        .onAppear {
            startAnimationSequence()
        }
        .sheet(isPresented: $viewModel.showingQRImport) {
            QRBackupImportView() // Task 9
        }
    }

    private func startAnimationSequence() {
        // Phase 1: Orb appears
        withAnimation(.easeOut(duration: 0.6)) {
            animationPhase = .orbAppearing
            orbScale = 1.0
            orbOpacity = 1.0
        }

        // Phase 2: Orb hatches
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.6)) {
                animationPhase = .orbHatching
            }
        }

        // Phase 3: Form appears
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation(.easeOut(duration: 0.5)) {
                animationPhase = .formAppearing
            }
        }
    }
}

// MARK: - Identity Orb View (Task 10)

struct IdentityOrbView: View {
    let scale: CGFloat
    let opacity: Double
    let isHatching: Bool

    @State private var rotationAngle: Double = 0
    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            // Outer glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.blue.opacity(0.3),
                            Color.purple.opacity(0.1),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 60
                    )
                )
                .frame(width: 120, height: 120)
                .scaleEffect(pulseScale)
                .opacity(opacity)

            // Main orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.blue.opacity(0.8),
                            Color.purple.opacity(0.6),
                            Color.pink.opacity(0.4)
                        ],
                        center: .topLeading,
                        startRadius: 10,
                        endRadius: 60
                    )
                )
                .frame(width: 100, height: 100)
                .scaleEffect(scale)
                .opacity(opacity)
                .overlay(
                    // Hatching cracks
                    Group {
                        if isHatching {
                            HatchingCracksView()
                                .transition(.opacity)
                        }
                    }
                )
                .rotationEffect(.degrees(rotationAngle))

            // Inner sparkle
            Circle()
                .fill(Color.white.opacity(0.3))
                .frame(width: 20, height: 20)
                .blur(radius: 10)
                .scaleEffect(scale * 0.3)
                .opacity(opacity)
        }
        .onAppear {
            // Continuous rotation
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                rotationAngle = 360
            }

            // Pulsing effect
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                pulseScale = 1.1
            }
        }
    }
}

struct HatchingCracksView: View {
    @State private var crackOpacity: Double = 0

    var body: some View {
        ZStack {
            // Animated crack lines
            ForEach(0..<6, id: \.self) { index in
                Path { path in
                    let angle = Double(index) * 60 * .pi / 180
                    let startRadius: CGFloat = 30
                    let endRadius: CGFloat = 50

                    let startX = cos(angle) * startRadius
                    let startY = sin(angle) * startRadius
                    let endX = cos(angle) * endRadius
                    let endY = sin(angle) * endRadius

                    path.move(to: CGPoint(x: 50 + startX, y: 50 + startY))
                    path.addLine(to: CGPoint(x: 50 + endX, y: 50 + endY))
                }
                .stroke(Color.white.opacity(0.6), lineWidth: 2)
                .opacity(crackOpacity)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.4)) {
                crackOpacity = 1.0
            }
        }
    }
}

// MARK: - View Model

@MainActor
class IdentitySetupViewModel: ObservableObject {
    @Published var isCreating = false
    @Published var showingQRImport = false

    private let didService = DIDService.shared

    func createIdentity() async {
        isCreating = true
        do {
            let did = try await didService.createDID()
            NotificationCenter.default.post(
                name: .identityCreated,
                object: nil,
                userInfo: ["did": did]
            )
        } catch {
            ErrorHandler.shared.handle(error, context: "Identity Creation")
        }
        isCreating = false
    }

    func beginWithScan() {
        // Task 7: Begin with scan default path
        NotificationCenter.default.post(
            name: .beginWithScan,
            object: nil
        )
    }

    func enterTrialMode() {
        // Task 8: Credential-less trial mode
        NotificationCenter.default.post(
            name: .trialModeEntered,
            object: nil
        )
    }
}

extension Notification.Name {
    static let identityCreated = Notification.Name("identityCreated")
    static let beginWithScan = Notification.Name("beginWithScan")
    static let trialModeEntered = Notification.Name("trialModeEntered")
}

#Preview {
    IdentitySetupView()
}

