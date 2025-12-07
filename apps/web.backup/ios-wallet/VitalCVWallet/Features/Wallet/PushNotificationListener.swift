//
//  PushNotificationListener.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 21
//  Push notification listener for credential changes
//

import Foundation
import UserNotifications
import Combine

/// PushNotificationListener - Listens for credential change notifications
@MainActor
class PushNotificationListener: ObservableObject {
    static let shared = PushNotificationListener()

    private let walletStateStore = WalletStateStore.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {
        setupNotificationHandling()
    }

    // MARK: - Task 21: Push Notification Listener

    private func setupNotificationHandling() {
        // Request notification permissions
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }

        // Listen for local notifications about credential changes
        NotificationCenter.default.publisher(for: .credentialChanged)
            .sink { [weak self] notification in
                self?.handleCredentialChange(notification)
            }
            .store(in: &cancellables)
    }

    private func handleCredentialChange(_ notification: Notification) {
        // Task 22: Trigger trust recalculation on credential change
        Task {
            await walletStateStore.syncWithBackend()
        }
    }

    /// Handle remote push notification
    func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) {
        guard let type = userInfo["type"] as? String else { return }

        switch type {
        case "credential_issued":
            Task {
                await walletStateStore.syncWithBackend()
            }
        case "credential_revoked":
            Task {
                await walletStateStore.syncWithBackend()
            }
        case "credential_updated":
            Task {
                await walletStateStore.syncWithBackend()
            }
        case "anchor_confirmed":
            Task {
                await walletStateStore.syncWithBackend()
            }
        default:
            break
        }
    }
}

extension Notification.Name {
    static let credentialChanged = Notification.Name("credentialChanged")
}

