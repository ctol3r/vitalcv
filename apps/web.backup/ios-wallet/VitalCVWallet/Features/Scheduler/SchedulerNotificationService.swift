//
//  SchedulerNotificationService.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 5
//  Push alerts and real-time updates for scheduler
//

import Foundation
import UserNotifications
import Combine

class SchedulerNotificationService {
    static let shared = SchedulerNotificationService()

    private var cancellables = Set<AnyCancellable>()
    private let networkService = NetworkService.shared

    private init() {
        requestNotificationPermission()
    }

    // MARK: - Notification Permission

    func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                print("Notification permission error: \(error)")
            }
        }
    }

    // MARK: - Push Alerts

    /// Alert when provider credential expires → remove from shift
    func handleCredentialExpired(providerId: String, credentialType: String, shiftId: String) {
        let content = UNMutableNotificationContent()
        content.title = "Credential Expired"
        content.body = "Provider credential (\(credentialType)) has expired. Remove from shift."
        content.sound = .default
        content.categoryIdentifier = "CREDENTIAL_EXPIRED"
        content.userInfo = [
            "providerId": providerId,
            "credentialType": credentialType,
            "shiftId": shiftId,
            "action": "removeFromShift"
        ]

        let request = UNNotificationRequest(
            identifier: "credential-expired-\(providerId)-\(shiftId)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    /// Alert when provider verified → add to eligible pool
    func handleProviderVerified(providerId: String, providerName: String) {
        let content = UNMutableNotificationContent()
        content.title = "Provider Verified"
        content.body = "\(providerName) has been verified and added to eligible pool."
        content.sound = .default
        content.categoryIdentifier = "PROVIDER_VERIFIED"
        content.userInfo = [
            "providerId": providerId,
            "action": "addToEligiblePool"
        ]

        let request = UNNotificationRequest(
            identifier: "provider-verified-\(providerId)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Real-time Anchor Verification

    func verifyOnDutyStaffAnchors(shiftId: String, providerIds: [String]) {
        // Verify chain anchors for all on-duty staff
        for providerId in providerIds {
            verifyProviderAnchor(providerId: providerId, shiftId: shiftId)
        }
    }

    private func verifyProviderAnchor(providerId: String, shiftId: String) {
        // This would call the chain verification service
        // For now, it's a placeholder that would integrate with VitalCVIntegrationLayer
        print("Verifying chain anchor for provider \(providerId) on shift \(shiftId)")
    }

    // MARK: - Trust Recalculation

    func recalculateTrustAfterReassignment(shiftId: String) {
        // Trigger trust score recalculation for the shift
        // This would update all provider trust scores based on latest credentials
        print("Recalculating trust scores for shift \(shiftId)")
    }
}

