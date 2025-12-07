//
//  BiometricAuthService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 9
//  FaceID/PIN authentication service
//

import Foundation
import LocalAuthentication
import Combine

@MainActor
class BiometricAuthService: ObservableObject {
    static let shared = BiometricAuthService()

    @Published var isBiometricAvailable: Bool = false
    @Published var biometricType: LABiometryType = .none
    @Published var isAuthenticated: Bool = false

    private let context = LAContext()

    private init() {
        checkBiometricAvailability()
    }

    func checkBiometricAvailability() {
        var error: NSError?
        isBiometricAvailable = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        if isBiometricAvailable {
            biometricType = context.biometryType
        }
    }

    func authenticate(reason: String = "Authenticate to access your wallet") async -> Bool {
        guard isBiometricAvailable else {
            return false
        }

        context.localizedCancelTitle = "Cancel"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )

            if success {
                isAuthenticated = true
            }

            return success
        } catch {
            print("Biometric authentication failed: \(error.localizedDescription)")
            return false
        }
    }

    func setupPIN(_ pin: String) -> Bool {
        // Hash PIN before storing
        let hashed = hashPIN(pin)
        return KeychainService.shared.savePINHash(hashed)
    }

    func verifyPIN(_ pin: String) -> Bool {
        guard let storedHash = KeychainService.shared.loadPINHash() else {
            return false
        }

        let hashed = hashPIN(pin)
        return hashed == storedHash
    }

    private func hashPIN(_ pin: String) -> String {
        // Simple hash - in production, use proper hashing (e.g., PBKDF2)
        let data = pin.data(using: .utf8)!
        return data.base64EncodedString()
    }

    func isPINSetup() -> Bool {
        return KeychainService.shared.loadPINHash() != nil
    }

    var biometricTypeName: String {
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
}








