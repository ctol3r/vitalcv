//
//  BiometricUnlockView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 7
//  Optional PIN + biometric unlock
//

import SwiftUI
import LocalAuthentication

struct BiometricUnlockView: View {
    @EnvironmentObject var appState: AppStateContainer
    @State private var pin: String = ""
    @State private var showingPINEntry = false
    @State private var authenticationError: String?
    @State private var biometricType: LABiometryType = .none

    var body: some View {
        ZStack {
            Color.walletBackground
                .ignoresSafeArea()

            VStack(spacing: WalletSpacing.xl) {
                Spacer()

                Image(systemName: biometricIcon)
                    .font(.system(size: 64))
                    .foregroundColor(.walletPrimary)

                Text("Unlock Wallet")
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(.walletText)

                if let error = authenticationError {
                    Text(error)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletError)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, WalletSpacing.lg)
                }

                if biometricType != .none {
                    Button(action: {
                        authenticateWithBiometrics()
                    }) {
                        HStack {
                            Image(systemName: biometricIcon)
                            Text("Unlock with \(biometricTypeName)")
                                .font(WalletTypography.headline)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary)
                        .cornerRadius(WalletCornerRadius.medium)
                    }
                    .padding(.horizontal, WalletSpacing.lg)

                    Button(action: {
                        showingPINEntry = true
                    }) {
                        Text("Use PIN Instead")
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletPrimary)
                    }
                } else {
                    Button(action: {
                        showingPINEntry = true
                    }) {
                        Text("Enter PIN")
                            .font(WalletTypography.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.walletPrimary)
                            .cornerRadius(WalletCornerRadius.medium)
                    }
                    .padding(.horizontal, WalletSpacing.lg)
                }

                Spacer()
            }
        }
        .onAppear {
            checkBiometricAvailability()
            authenticateWithBiometrics()
        }
        .sheet(isPresented: $showingPINEntry) {
            PINEntryView()
        }
    }

    private var biometricIcon: String {
        switch biometricType {
        case .faceID:
            return "faceid"
        case .touchID:
            return "touchid"
        default:
            return "lock.shield.fill"
        }
    }

    private var biometricTypeName: String {
        switch biometricType {
        case .faceID:
            return "Face ID"
        case .touchID:
            return "Touch ID"
        default:
            return "Biometrics"
        }
    }

    private func checkBiometricAvailability() {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            biometricType = context.biometryType
        } else {
            biometricType = .none
        }
    }

    private func authenticateWithBiometrics() {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            authenticationError = "Biometric authentication not available"
            return
        }

        let reason = "Authenticate to unlock your wallet"

        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                if success {
                    // Unlock wallet
                    appState.isAuthenticated = true
                    authenticationError = nil
                } else {
                    authenticationError = error?.localizedDescription ?? "Authentication failed"
                }
            }
        }
    }
}

struct PINEntryView: View {
    @EnvironmentObject var appState: AppStateContainer
    @Environment(\.dismiss) var dismiss
    @State private var pin: String = ""
    @State private var authenticationError: String?
    @FocusState private var isPINFocused: Bool

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.xl) {
                Spacer()

                Text("Enter PIN")
                    .font(WalletTypography.largeTitle)
                    .foregroundColor(.walletText)

                SecureField("PIN", text: $pin)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.system(size: 32, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .padding()
                    .background(Color.walletCard)
                    .cornerRadius(WalletCornerRadius.medium)
                    .walletShadow(WalletShadow.medium)
                    .focused($isPINFocused)
                    .onChange(of: pin) { newValue in
                        if newValue.count == 6 {
                            verifyPIN(newValue)
                        }
                    }

                if let error = authenticationError {
                    Text(error)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletError)
                }

                Spacer()
            }
            .padding(WalletSpacing.lg)
            .navigationTitle("Unlock Wallet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                isPINFocused = true
            }
        }
    }

    private func verifyPIN(_ enteredPIN: String) {
        // Verify PIN hash from Keychain
        guard let storedHash = KeychainService.shared.loadPINHash() else {
            // No PIN set, allow access
            appState.isAuthenticated = true
            dismiss()
            return
        }

        // In production, hash the entered PIN and compare
        // For now, simple comparison (NOT SECURE - use proper hashing)
        if storedHash == enteredPIN {
            appState.isAuthenticated = true
            dismiss()
        } else {
            authenticationError = "Incorrect PIN"
            pin = ""
        }
    }
}

#Preview {
    BiometricUnlockView()
        .environmentObject(AppStateContainer.shared)
}

