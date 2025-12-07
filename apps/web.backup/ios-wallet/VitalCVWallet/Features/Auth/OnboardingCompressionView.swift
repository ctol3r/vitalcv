//
//  OnboardingCompressionView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 7
//  Onboarding compression (3 taps max)
//

import SwiftUI

/// OnboardingCompressionView - Ultra-compressed onboarding (3 taps max)
struct OnboardingCompressionView: View {
    @EnvironmentObject var appState: AppStateContainer
    @State private var currentStep: OnboardingStep = .welcome
    @State private var tapCount: Int = 0

    enum OnboardingStep: Int, CaseIterable {
        case welcome = 0
        case scan = 1
        case ready = 2

        var title: String {
            switch self {
            case .welcome: return "Welcome"
            case .scan: return "Scan to Start"
            case .ready: return "You're Ready"
            }
        }

        var description: String {
            switch self {
            case .welcome: return "Your digital identity in 3 taps"
            case .scan: return "Scan a credential QR code"
            case .ready: return "Start using your wallet"
            }
        }

        var icon: String {
            switch self {
            case .welcome: return "sparkles"
            case .scan: return "qrcode.viewfinder"
            case .ready: return "checkmark.circle.fill"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Progress indicator
            HStack(spacing: 8) {
                ForEach(0..<OnboardingStep.allCases.count, id: \.self) { index in
                    Circle()
                        .fill(index <= currentStep.rawValue ? Color.walletPrimary : Color.walletCard)
                        .frame(width: 8, height: 8)
                }
            }
            .padding(.top, WalletSpacing.lg)
            .padding(.bottom, WalletSpacing.xl)

            // Content
            VStack(spacing: WalletSpacing.xl) {
                Image(systemName: currentStep.icon)
                    .font(.system(size: 80))
                    .foregroundColor(.walletPrimary)

                Text(currentStep.title)
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(.walletText)

                Text(currentStep.description)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Single action button (tap to advance)
            Button(action: {
                handleTap()
            }) {
                Text(buttonText)
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.medium)
            }
            .padding(.horizontal, WalletSpacing.lg)
            .padding(.bottom, WalletSpacing.xl)
        }
        .background(Color.walletBackground)
    }

    private var buttonText: String {
        switch currentStep {
        case .welcome: return "Start"
        case .scan: return "Scan Now"
        case .ready: return "Get Started"
        }
    }

    private func handleTap() {
        tapCount += 1

        withAnimation {
            switch currentStep {
            case .welcome:
                currentStep = .scan
            case .scan:
                // Open scanner
                showScanner()
            case .ready:
                completeOnboarding()
            }
        }
    }

    private func showScanner() {
        // Present scanner
        // In production, use sheet or navigation
    }

    private func completeOnboarding() {
        // Auto-create DID if needed (Task 8)
        Task {
            if !DIDService.shared.hasDID() {
                do {
                    let did = try await DIDService.shared.createDID()
                    await MainActor.run {
                        appState.authenticate(did: did)
                    }
                } catch {
                    // Handle error
                }
            } else {
                appState.isAuthenticated = true
            }
        }
    }
}

#Preview {
    OnboardingCompressionView()
        .environmentObject(AppStateContainer.shared)
}

