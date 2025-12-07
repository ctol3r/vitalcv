//
//  OIDC4VPRequestLoaderView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 2 - Task 12
//  OIDC4VP Request Loader for App Clip
//

import SwiftUI

struct OIDC4VPRequestLoaderView: View {
    let payload: QRPayload
    @EnvironmentObject var clipState: AppClipState
    @StateObject private var service = OIDC4VPService.shared
    @State private var request: OIDC4VPRequest?
    @State private var isLoading = true
    @State private var error: Error?

    var body: some View {
        ZStack {
            Color.walletBackground.ignoresSafeArea()

            if isLoading {
                LoadingView()
            } else if let request = request {
                VPRequestView(request: request)
            } else if let error = error {
                ErrorView(error: error)
            }
        }
        .task {
            await loadRequest()
        }
    }

    private func loadRequest() async {
        do {
            // Parse OIDC4VP request from payload
            let request = try await service.parseRequest(payload: payload)
            self.request = request
            isLoading = false
        } catch {
            self.error = error
            isLoading = false
        }
    }
}

// MARK: - VP Request View

struct VPRequestView: View {
    let request: OIDC4VPRequest
    @StateObject private var service = OIDC4VPService.shared
    @State private var isSubmitting = false

    var body: some View {
        VStack(spacing: 20) {
            Text("Verification Request")
                .font(WalletTypography.title)

            Text("A verifier is requesting your credentials")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)

            // Request details
            VStack(alignment: .leading, spacing: 12) {
                if let clientName = request.clientName {
                    Label(clientName, systemImage: "person.fill")
                }

                if let purpose = request.purpose {
                    Label(purpose, systemImage: "info.circle")
                }
            }
            .padding()
            .background(Color.walletCardBackground)
            .cornerRadius(WalletCornerRadius.medium)

            Button(action: {
                Task {
                    await submitVP()
                }
            }) {
                if isSubmitting {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Text("Submit Verification")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSubmitting)
        }
        .padding()
    }

    private func submitVP() async {
        isSubmitting = true
        // Submit VP for OIDC4VP request
        // Implementation would go here
        isSubmitting = false
    }
}

// MARK: - OIDC4VP Service

class OIDC4VPService {
    static let shared = OIDC4VPService()

    func parseRequest(payload: QRPayload) async throws -> OIDC4VPRequest {
        // Parse OIDC4VP request from payload
        // Simplified implementation
        return OIDC4VPRequest(
            clientId: "verifier",
            clientName: "Verifier",
            purpose: "Credential verification",
            requestedCredentials: []
        )
    }
}

struct OIDC4VPRequest {
    let clientId: String
    let clientName: String?
    let purpose: String?
    let requestedCredentials: [String]
}




