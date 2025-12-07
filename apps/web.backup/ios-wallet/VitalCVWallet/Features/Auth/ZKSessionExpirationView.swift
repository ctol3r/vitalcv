//
//  ZKSessionExpirationView.swift
//  VitalCVWallet
//
//  Created: Zero-Knowledge Authorization Engine - Phase 3, Task 28
//  Session expiration UI with trustGlow when renewed
//

import SwiftUI

/// ZKSessionExpirationView - UI for session expiration with renewal
public struct ZKSessionExpirationView: View {
    @StateObject private var viewModel: ZKSessionExpirationViewModel
    @State private var showRenewalAnimation = false

    let sessionToken: ZKSessionToken

    public init(sessionToken: ZKSessionToken) {
        self.sessionToken = sessionToken
        _viewModel = StateObject(wrappedValue: ZKSessionExpirationViewModel(sessionToken: sessionToken))
    }

    public var body: some View {
        VStack(spacing: 20) {
            // Session status
            HStack {
                Image(systemName: viewModel.isExpired ? "exclamationmark.triangle.fill" : "clock.fill")
                    .foregroundColor(viewModel.isExpired ? .red : .orange)

                VStack(alignment: .leading, spacing: 4) {
                    Text(viewModel.isExpired ? "Session Expired" : "Session Expiring Soon")
                        .font(.headline)

                    Text(viewModel.timeRemaining)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)

            // Renewal button
            Button(action: {
                Task {
                    await viewModel.renewSession()
                    if viewModel.renewalSuccess {
                        // Phase 3 - Task 28: Trust glow when renewed
                        withAnimation {
                            showRenewalAnimation = true
                        }
                    }
                }
            }) {
                HStack {
                    if viewModel.isRenewing {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    }
                    Text(viewModel.isRenewing ? "Renewing..." : "Renew Session")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(viewModel.isRenewing ? Color.gray : Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.isRenewing)
            .trustGlow(radius: showRenewalAnimation ? 30 : 0, strength: showRenewalAnimation ? 0.8 : 0)
            .animation(.easeInOut(duration: 0.5), value: showRenewalAnimation)

            // Success message
            if viewModel.renewalSuccess {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Session renewed successfully")
                        .font(.subheadline)
                        .foregroundColor(.green)
                }
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(12)
                .transition(.opacity)
            }
        }
        .padding()
    }
}

@MainActor
class ZKSessionExpirationViewModel: ObservableObject {
    @Published var isRenewing = false
    @Published var renewalSuccess = false
    @Published var isExpired = false
    @Published var timeRemaining = ""

    private let sessionToken: ZKSessionToken
    private let sessionTokenCreator = ZKSessionTokenCreator.shared
    private var timer: Timer?

    init(sessionToken: ZKSessionToken) {
        self.sessionToken = sessionToken
        updateExpirationStatus()
        startTimer()
    }

    private func updateExpirationStatus() {
        let now = Date()
        isExpired = now >= sessionToken.expiresAt

        if isExpired {
            timeRemaining = "Expired"
        } else {
            let remaining = sessionToken.expiresAt.timeIntervalSince(now)
            let minutes = Int(remaining / 60)
            let seconds = Int(remaining.truncatingRemainder(dividingBy: 60))
            timeRemaining = "\(minutes)m \(seconds)s remaining"
        }
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateExpirationStatus()
        }
    }

    func renewSession() async {
        guard let did = DIDService.shared.loadDID() else {
            return
        }

        isRenewing = true
        renewalSuccess = false

        do {
            // Create new session token
            let newToken = try await sessionTokenCreator.createSessionToken(
                did: did,
                scope: sessionToken.scope,
                duration: 3600
            )

            // Update token (in production, store in session manager)
            renewalSuccess = true

            // Reset after showing success
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                self.renewalSuccess = false
            }
        } catch {
            // Handle error
            renewalSuccess = false
        }

        isRenewing = false
    }

    deinit {
        timer?.invalidate()
    }
}

