//
//  TrustState.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 1, Task 2
//  Trust state enum for all verification states
//

import SwiftUI

/// TrustState - Represents the current trust verification state
enum TrustState: Equatable {
    case idle           // Initial state, no verification active
    case verifying      // Verification in progress
    case passed         // Verification successful
    case warning        // Verification passed with warnings
    case failed         // Verification failed

    var color: Color {
        switch self {
        case .idle:
            return .walletTextSecondary
        case .verifying:
            return .walletInfo
        case .passed:
            return .walletSuccess
        case .warning:
            return .walletWarning
        case .failed:
            return .walletError
        }
    }

    var icon: String {
        switch self {
        case .idle:
            return "circle"
        case .verifying:
            return "arrow.clockwise"
        case .passed:
            return "checkmark.shield.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .failed:
            return "xmark.shield.fill"
        }
    }

    var description: String {
        switch self {
        case .idle:
            return "Ready to verify"
        case .verifying:
            return "Verifying..."
        case .passed:
            return "Verified"
        case .warning:
            return "Verified with warnings"
        case .failed:
            return "Verification failed"
        }
    }
}

