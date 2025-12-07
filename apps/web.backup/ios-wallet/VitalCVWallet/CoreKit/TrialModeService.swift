//
//  TrialModeService.swift
//  VitalCVWallet
//
//  Created: Batch 551 - Task 8
//  Credential-less trial mode
//

import Foundation

/// Service for managing credential-less trial mode
/// Allows users to explore the app without creating an identity
@MainActor
public class TrialModeService: ObservableObject {
    public static let shared = TrialModeService()

    @Published public var isTrialMode: Bool = false
    @Published public var trialStartDate: Date?
    @Published public var trialDaysRemaining: Int = 7

    private let trialDurationDays = 7
    private let keychainKey = "trial_mode_enabled"
    private let keychainStartDateKey = "trial_start_date"

    private init() {
        loadTrialState()
    }

    // MARK: - Trial Mode Management

    /// Enter trial mode (credential-less exploration)
    public func enterTrialMode() {
        isTrialMode = true
        trialStartDate = Date()

        // Save to keychain
        KeychainService.shared.save(keychainKey, value: "true")
        if let date = trialStartDate {
            KeychainService.shared.save(keychainStartDateKey, value: String(date.timeIntervalSince1970))
        }

        // Post notification
        NotificationCenter.default.post(
            name: .trialModeEntered,
            object: nil
        )

        Logger.shared.log("Trial mode entered", level: .info)
    }

    /// Exit trial mode (user creates identity)
    public func exitTrialMode() {
        isTrialMode = false
        trialStartDate = nil
        trialDaysRemaining = trialDurationDays

        // Remove from keychain
        KeychainService.shared.delete(keychainKey)
        KeychainService.shared.delete(keychainStartDateKey)

        // Post notification
        NotificationCenter.default.post(
            name: .trialModeExited,
            object: nil
        )

        Logger.shared.log("Trial mode exited", level: .info)
    }

    /// Check if trial mode is still valid
    public func checkTrialValidity() -> Bool {
        guard isTrialMode, let startDate = trialStartDate else {
            return false
        }

        let daysElapsed = Calendar.current.dateComponents([.day], from: startDate, to: Date()).day ?? 0
        trialDaysRemaining = max(0, trialDurationDays - daysElapsed)

        if trialDaysRemaining == 0 {
            // Trial expired
            exitTrialMode()
            return false
        }

        return true
    }

    // MARK: - Trial Limitations

    /// Check if a feature is available in trial mode
    public func isFeatureAvailable(_ feature: TrialFeature) -> Bool {
        guard isTrialMode else { return true } // Full access when not in trial

        switch feature {
        case .viewCredentials:
            return true // Can view demo credentials
        case .addCredential:
            return false // Cannot add real credentials
        case .shareCredential:
            return false // Cannot share credentials
        case .verifyCredential:
            return true // Can verify (read-only)
        case .scanQR:
            return true // Can scan (read-only)
        case .exportBackup:
            return false // Cannot export
        case .importBackup:
            return true // Can import (demo)
        }
    }

    /// Get trial mode message for a feature
    public func getTrialMessage(for feature: TrialFeature) -> String {
        switch feature {
        case .addCredential:
            return "Create an identity to add credentials"
        case .shareCredential:
            return "Create an identity to share credentials"
        case .exportBackup:
            return "Create an identity to export your data"
        default:
            return "This feature requires an identity"
        }
    }

    // MARK: - Private

    private func loadTrialState() {
        if let enabled = KeychainService.shared.load(keychainKey), enabled == "true" {
            isTrialMode = true

            if let dateString = KeychainService.shared.load(keychainStartDateKey),
               let timestamp = Double(dateString) {
                trialStartDate = Date(timeIntervalSince1970: timestamp)
                _ = checkTrialValidity()
            } else {
                trialStartDate = Date()
            }
        }
    }
}

// MARK: - Trial Features

public enum TrialFeature {
    case viewCredentials
    case addCredential
    case shareCredential
    case verifyCredential
    case scanQR
    case exportBackup
    case importBackup
}

extension Notification.Name {
    static let trialModeExited = Notification.Name("trialModeExited")
}

