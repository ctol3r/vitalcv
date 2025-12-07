//
//  BiometricProofGate.swift
//  VitalCVWallet
//
//  Created: Batch 136-A - Task 4
//  Biometric-gated proof submission
//

import Foundation
import LocalAuthentication
import Combine

/// BiometricProofGate - Gates proof submission behind biometric authentication
@MainActor
public class BiometricProofGate: ObservableObject {
    public static let shared = BiometricProofGate()

    // MARK: - Published Properties

    @Published public var isBiometricAvailable: Bool = false
    @Published public var biometricType: LABiometryType = .none
    @Published public var lastAuthenticationTime: Date?

    // MARK: - Configuration

    /// Time window for re-authentication (default: 5 minutes)
    public var authenticationWindow: TimeInterval = 5 * 60

    /// Require biometric for every proof submission
    public var requireBiometricPerSubmission: Bool = true

    private let context = LAContext()

    // MARK: - Initialization

    private init() {
        checkBiometricAvailability()
    }

    // MARK: - Biometric Check

    private func checkBiometricAvailability() {
        var error: NSError?
        isBiometricAvailable = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        if isBiometricAvailable {
            biometricType = context.biometryType
        }
    }

    // MARK: - Proof Submission Gate

    /// Check if proof submission is allowed (with optional biometric gate)
    public func canSubmitProof(forceBiometric: Bool = false) async -> Bool {
        // If biometric is not available, allow submission (fallback)
        guard isBiometricAvailable else {
            return true
        }

        // Check if we need to re-authenticate
        if requireBiometricPerSubmission || forceBiometric {
            return await authenticateForProofSubmission()
        }

        // Check if authentication is still valid
        if let lastAuth = lastAuthenticationTime {
            let age = Date().timeIntervalSince(lastAuth)
            if age < authenticationWindow {
                return true
            }
        }

        // Need to re-authenticate
        return await authenticateForProofSubmission()
    }

    /// Authenticate for proof submission
    public func authenticateForProofSubmission(reason: String? = nil) async -> Bool {
        let authReason = reason ?? "Authenticate to submit proof"

        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = "Use Passcode"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: authReason
            )

            if success {
                lastAuthenticationTime = Date()
            }

            return success
        } catch {
            print("Biometric authentication failed: \(error.localizedDescription)")
            return false
        }
    }

    /// Submit proof with biometric gate
    public func submitProof<T>(
        proof: T,
        submission: @escaping (T) async throws -> Void
    ) async throws {
        // Check biometric gate
        guard await canSubmitProof() else {
            throw BiometricProofGateError.authenticationFailed
        }

        // Submit proof
        try await submission(proof)
    }

    /// Submit proof with explicit biometric authentication
    public func submitProofWithBiometric<T>(
        proof: T,
        reason: String? = nil,
        submission: @escaping (T) async throws -> Void
    ) async throws {
        // Force biometric authentication
        guard await authenticateForProofSubmission(reason: reason) else {
            throw BiometricProofGateError.authenticationFailed
        }

        // Submit proof
        try await submission(proof)
    }

    // MARK: - Biometric Type

    public var biometricTypeName: String {
        switch biometricType {
        case .faceID:
            return "Face ID"
        case .touchID:
            return "Touch ID"
        case .opticID:
            return "Optic ID"
        default:
            return "Biometric"
        }
    }

    /// Reset authentication state (for testing or logout)
    public func resetAuthentication() {
        lastAuthenticationTime = nil
        context.invalidate()
    }
}

// MARK: - Errors

public enum BiometricProofGateError: Error, LocalizedError {
    case authenticationFailed
    case biometricNotAvailable
    case authenticationCancelled

    public var errorDescription: String? {
        switch self {
        case .authenticationFailed:
            return "Biometric authentication failed"
        case .biometricNotAvailable:
            return "Biometric authentication is not available"
        case .authenticationCancelled:
            return "Biometric authentication was cancelled"
        }
    }
}








