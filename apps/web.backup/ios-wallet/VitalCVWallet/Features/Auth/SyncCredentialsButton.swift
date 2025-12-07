//
//  SyncCredentialsButton.swift
//  VitalCVWallet
//
//  Created: Batch 560 - Task 10
//  "Tap to Sync Credentials" onboarding button
//

import SwiftUI

/// SyncCredentialsButton - Onboarding button for syncing credentials
/// Provides one-tap credential synchronization during onboarding
struct SyncCredentialsButton: View {
    @State private var isSyncing = false
    @State private var syncProgress: Double = 0.0
    @State private var syncStatus: SyncStatus = .idle

    let onSyncComplete: ([VerifiableCredential]) -> Void

    var body: some View {
        VStack(spacing: 16) {
            // Button
            Button(action: {
                guard !isSyncing else { return }
                startSync()
            }) {
                HStack(spacing: 12) {
                    if isSyncing {
                        // Progress indicator
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: syncStatus.icon)
                            .font(.system(size: 18, weight: .semibold))
                    }

                    Text(syncStatus.title)
                        .font(WalletTypography.headline)

                    if syncStatus == .success {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 18))
                    }
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    syncStatus == .success ? Color.walletSuccess :
                    syncStatus == .error ? Color.walletError :
                    Color.walletPrimary
                )
                .cornerRadius(WalletCornerRadius.medium)
                .opacity(isSyncing ? 0.7 : 1.0)
            }
            .disabled(isSyncing)

            // Progress bar (shown during sync)
            if isSyncing {
                ProgressView(value: syncProgress)
                    .progressViewStyle(LinearProgressViewStyle(tint: Color.walletPrimary))
                    .frame(height: 4)
                    .transition(.opacity)
            }

            // Status message
            if syncStatus != .idle {
                Text(syncStatus.message)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .transition(.opacity)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func startSync() {
        isSyncing = true
        syncStatus = .syncing
        syncProgress = 0.0

        Task {
            // Simulate sync progress
            await animateProgress()

            // Perform actual sync
            do {
                let credentials = try await WalletCore.shared.syncCredentials()

                await MainActor.run {
                    syncStatus = .success
                    syncProgress = 1.0
                    isSyncing = false
                    onSyncComplete(credentials)
                }
            } catch {
                await MainActor.run {
                    syncStatus = .error(error.localizedDescription)
                    syncProgress = 0.0
                    isSyncing = false
                }
            }
        }
    }

    private func animateProgress() async {
        // Animate progress from 0 to 0.9 (actual sync will complete it)
        for progress in stride(from: 0.0, through: 0.9, by: 0.1) {
            try? await Task.sleep(nanoseconds: 200_000_000) // 0.2 seconds
            await MainActor.run {
                withAnimation(.linear(duration: 0.2)) {
                    syncProgress = progress
                }
            }
        }
    }
}

enum SyncStatus {
    case idle
    case syncing
    case success
    case error(String)

    var title: String {
        switch self {
        case .idle:
            return "Tap to Sync Credentials"
        case .syncing:
            return "Syncing..."
        case .success:
            return "Sync Complete"
        case .error:
            return "Sync Failed"
        }
    }

    var icon: String {
        switch self {
        case .idle:
            return "arrow.clockwise"
        case .syncing:
            return "arrow.clockwise"
        case .success:
            return "checkmark.circle.fill"
        case .error:
            return "exclamationmark.triangle.fill"
        }
    }

    var message: String {
        switch self {
        case .idle:
            return "Sync your credentials from connected issuers"
        case .syncing:
            return "Fetching credentials from your connected accounts..."
        case .success:
            return "All credentials have been synced successfully"
        case .error(let error):
            return error
        }
    }
}

// Extension to WalletCore for sync that returns credentials
extension WalletCore {
    func syncCredentials() async throws -> [VerifiableCredential] {
        try await sync()
        return credentials
    }
}

#Preview {
    SyncCredentialsButton { credentials in
        print("Synced \(credentials.count) credentials")
    }
    .padding()
    .background(Color.walletBackground)
}

