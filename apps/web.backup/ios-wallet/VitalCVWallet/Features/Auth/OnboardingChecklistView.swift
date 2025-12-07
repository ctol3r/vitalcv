//
//  OnboardingChecklistView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 9
//  Onboarding checklist (3 steps)
//

import SwiftUI

struct OnboardingChecklistView: View {
    @EnvironmentObject var appState: AppStateContainer
    @State private var completedSteps: Set<OnboardingStep> = []
    @State private var currentStep: OnboardingStep = .createIdentity

    enum OnboardingStep: String, CaseIterable, Identifiable {
        case createIdentity = "Create Identity"
        case addCredential = "Add First Credential"
        case setupSecurity = "Setup Security"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .createIdentity: return "person.badge.key.fill"
            case .addCredential: return "doc.badge.plus"
            case .setupSecurity: return "lock.shield.fill"
            }
        }

        var description: String {
            switch self {
            case .createIdentity: return "Generate your decentralized identity (DID)"
            case .addCredential: return "Scan or import your first credential"
            case .setupSecurity: return "Enable biometrics or PIN protection"
            }
        }
    }

    var body: some View {
        VStack(spacing: WalletSpacing.xl) {
            // Header
            VStack(spacing: WalletSpacing.md) {
                Text("Setup Your Wallet")
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(.walletText)

                Text("Complete these steps to get started")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
            .padding(.top, WalletSpacing.xl)

            // Checklist
            VStack(spacing: WalletSpacing.md) {
                ForEach(OnboardingStep.allCases) { step in
                    ChecklistItemView(
                        step: step,
                        isCompleted: completedSteps.contains(step),
                        isCurrent: currentStep == step,
                        onTap: {
                            handleStepTap(step)
                        }
                    )
                }
            }
            .padding(.horizontal, WalletSpacing.lg)

            Spacer()

            // Progress indicator
            VStack(spacing: WalletSpacing.sm) {
                ProgressView(value: Double(completedSteps.count), total: Double(OnboardingStep.allCases.count))
                    .progressViewStyle(LinearProgressViewStyle(tint: .walletPrimary))

                Text("\(completedSteps.count) of \(OnboardingStep.allCases.count) completed")
                    .font(WalletTypography.footnote)
                    .foregroundColor(.walletTextSecondary)
            }
            .padding(.horizontal, WalletSpacing.lg)
            .padding(.bottom, WalletSpacing.xl)
        }
        .onAppear {
            checkCompletedSteps()
        }
    }

    private func checkCompletedSteps() {
        // Check if identity is created
        if appState.currentUserDid != nil {
            completedSteps.insert(.createIdentity)
        }

        // Check if credentials exist
        if !appState.credentials.isEmpty {
            completedSteps.insert(.addCredential)
        }

        // Check if security is set up
        if appState.biometricEnabled {
            completedSteps.insert(.setupSecurity)
        }

        // Set current step to first incomplete
        if !completedSteps.contains(.createIdentity) {
            currentStep = .createIdentity
        } else if !completedSteps.contains(.addCredential) {
            currentStep = .addCredential
        } else if !completedSteps.contains(.setupSecurity) {
            currentStep = .setupSecurity
        }
    }

    private func handleStepTap(_ step: OnboardingStep) {
        currentStep = step

        switch step {
        case .createIdentity:
            // Navigate to DID creation
            break
        case .addCredential:
            // Navigate to credential import/scan
            break
        case .setupSecurity:
            // Navigate to security setup
            break
        }
    }
}

// MARK: - Checklist Item View

struct ChecklistItemView: View {
    let step: OnboardingChecklistView.OnboardingStep
    let isCompleted: Bool
    let isCurrent: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: WalletSpacing.md) {
                // Status icon
                ZStack {
                    Circle()
                        .fill(isCompleted ? Color.walletSuccess : (isCurrent ? Color.walletPrimary : Color.walletTextSecondary.opacity(0.2)))
                        .frame(width: 40, height: 40)

                    if isCompleted {
                        Image(systemName: "checkmark")
                            .foregroundColor(.white)
                            .font(.system(size: 16, weight: .bold))
                    } else {
                        Image(systemName: step.icon)
                            .foregroundColor(isCurrent ? .white : .walletTextSecondary)
                            .font(.system(size: 18))
                    }
                }

                // Step info
                VStack(alignment: .leading, spacing: 4) {
                    Text(step.rawValue)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text(step.description)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                if isCurrent && !isCompleted {
                    Image(systemName: "chevron.right")
                        .foregroundColor(.walletPrimary)
                        .font(.caption)
                }
            }
            .padding()
            .background(isCurrent ? Color.walletPrimary.opacity(0.1) : Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
            .overlay(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .stroke(isCurrent ? Color.walletPrimary : Color.clear, lineWidth: 2)
            )
            .walletShadow(isCurrent ? WalletShadow.medium : WalletShadow.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    OnboardingChecklistView()
        .environmentObject(AppStateContainer.shared)
}








