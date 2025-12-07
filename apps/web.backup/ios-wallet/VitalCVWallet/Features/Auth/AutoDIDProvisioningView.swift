//
//  AutoDIDProvisioningView.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 7
//  Auto-DID provisioning progress ring
//

import SwiftUI

/// AutoDIDProvisioningView - Progress ring for automatic DID provisioning
/// Shows visual progress during DID creation and setup
struct AutoDIDProvisioningView: View {
    @State private var provisioningProgress: Double = 0.0
    @State private var currentStep: DIDProvisioningStep = .generating
    @State private var isProvisioning = false

    let onProvisioningComplete: (String) -> Void // DID string

    var body: some View {
        VStack(spacing: 30) {
            // Progress Ring
            ZStack {
                // Background ring
                Circle()
                    .stroke(
                        Color.walletCard,
                        lineWidth: 8
                    )
                    .frame(width: 120, height: 120)

                // Progress ring
                Circle()
                    .trim(from: 0, to: provisioningProgress)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.walletPrimary,
                                Color.walletPrimary.opacity(0.6)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 8, lineCap: .round)
                    )
                    .frame(width: 120, height: 120)
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut(duration: 0.3), value: provisioningProgress)

                // Center content
                VStack(spacing: 4) {
                    Text(currentStep.emoji)
                        .font(.system(size: 32))

                    Text("\(Int(provisioningProgress * 100))%")
                        .font(WalletTypography.caption)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            // Step description
            VStack(spacing: 8) {
                Text(currentStep.title)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletTextPrimary)

                Text(currentStep.description)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            // Step indicators
            HStack(spacing: 8) {
                ForEach(DIDProvisioningStep.allCases, id: \.self) { step in
                    Circle()
                        .fill(step == currentStep ? Color.walletPrimary : Color.walletCard)
                        .frame(width: 8, height: 8)
                }
            }
        }
        .onAppear {
            startProvisioning()
        }
    }

    private func startProvisioning() {
        isProvisioning = true

        Task {
            // Step 1: Generating keys (0-30%)
            await updateStep(.generating, progress: 0.3, duration: 1.0)

            // Step 2: Creating DID (30-60%)
            await updateStep(.creating, progress: 0.6, duration: 1.0)

            // Step 3: Registering (60-90%)
            await updateStep(.registering, progress: 0.9, duration: 1.0)

            // Step 4: Completing (90-100%)
            await updateStep(.completing, progress: 1.0, duration: 0.5)

            // Generate DID
            let did = await generateDID()

            await MainActor.run {
                currentStep = .complete
                isProvisioning = false
                onProvisioningComplete(did)
            }
        }
    }

    private func updateStep(_ step: DIDProvisioningStep, progress: Double, duration: Double) async {
        await MainActor.run {
            currentStep = step
        }

        withAnimation(.easeInOut(duration: duration)) {
            provisioningProgress = progress
        }

        try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
    }

    private func generateDID() async -> String {
        // Simulate DID generation
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        // In production, use actual DID service
        return await DIDService.shared.createDID().id
    }
}

enum DIDProvisioningStep: CaseIterable {
    case generating
    case creating
    case registering
    case completing
    case complete

    var emoji: String {
        switch self {
        case .generating:
            return "🔑"
        case .creating:
            return "🆔"
        case .registering:
            return "📡"
        case .completing:
            return "✨"
        case .complete:
            return "✅"
        }
    }

    var title: String {
        switch self {
        case .generating:
            return "Generating Keys"
        case .creating:
            return "Creating DID"
        case .registering:
            return "Registering Identity"
        case .completing:
            return "Finalizing"
        case .complete:
            return "Complete"
        }
    }

    var description: String {
        switch self {
        case .generating:
            return "Creating cryptographic key pair..."
        case .creating:
            return "Generating your decentralized identifier..."
        case .registering:
            return "Registering with identity network..."
        case .completing:
            return "Almost done..."
        case .complete:
            return "Your DID is ready!"
        }
    }
}

#Preview {
    AutoDIDProvisioningView { did in
        print("DID provisioned: \(did)")
    }
    .padding()
    .background(Color.walletBackground)
}

