//
//  IssuerAuthenticityModal.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 19
//  Issuer authenticity modal
//

import SwiftUI

/// IssuerAuthenticityModal - Modal showing detailed issuer authenticity information
struct IssuerAuthenticityModal: View {
    let issuer: Issuer
    @Binding var isPresented: Bool
    @State private var authenticityDetails: AuthenticityDetails?
    @State private var isLoading = true

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else if let details = authenticityDetails {
                        // Status header
                        VStack(spacing: WalletSpacing.md) {
                            Image(systemName: details.status.icon)
                                .font(.system(size: 60))
                                .foregroundColor(details.status.color)

                            Text(details.status.text)
                                .font(WalletTypography.largeTitle)
                                .foregroundColor(details.status.color)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()

                        Divider()

                        // Issuer information
                        SectionView(title: "Issuer Information") {
                            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                                InfoRow(label: "Name", value: issuer.name ?? "Unknown")
                                InfoRow(label: "DID", value: issuer.id)
                                InfoRow(label: "Status", value: details.status.text)
                            }
                        }

                        // Trust registry
                        if let registry = details.trustRegistry {
                            SectionView(title: "Trust Registry") {
                                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                                    InfoRow(label: "Registry", value: registry.name)
                                    InfoRow(label: "Verified Since", value: formatDate(registry.verifiedSince))
                                    if let accreditation = registry.accreditation {
                                        InfoRow(label: "Accreditation", value: accreditation)
                                    }
                                }
                            }
                        }

                        // Verification details
                        SectionView(title: "Verification Details") {
                            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                                ForEach(details.verificationChecks, id: \.name) { check in
                                    HStack {
                                        Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                            .foregroundColor(check.passed ? .walletSuccess : .walletError)
                                        Text(check.name)
                                            .font(WalletTypography.body)
                                        Spacer()
                                    }
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Issuer Authenticity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
        }
        .onAppear {
            loadAuthenticityDetails()
        }
    }

    private func loadAuthenticityDetails() {
        isLoading = true

        Task {
            // Simulate API call
            try? await Task.sleep(nanoseconds: 500_000_000)

            let details = AuthenticityDetails(
                status: .verified,
                trustRegistry: TrustRegistryInfo(
                    name: "VitalCV Trust Registry",
                    verifiedSince: Date().addingTimeInterval(-86400 * 365),
                    accreditation: "ISO 27001 Certified"
                ),
                verificationChecks: [
                    VerificationCheck(name: "DID Resolution", passed: true),
                    VerificationCheck(name: "Public Key Verification", passed: true),
                    VerificationCheck(name: "Trust Registry Entry", passed: true),
                    VerificationCheck(name: "Revocation Status", passed: true)
                ]
            )

            await MainActor.run {
                self.authenticityDetails = details
                self.isLoading = false
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        return formatter.string(from: date)
    }
}

// MARK: - Section View

struct SectionView<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text(title)
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            content
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

// MARK: - Info Row

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
            Spacer()
            Text(value)
                .font(WalletTypography.body)
                .foregroundColor(.walletText)
        }
    }
}

// MARK: - Models

struct AuthenticityDetails {
    let status: AuthenticityStatus
    let trustRegistry: TrustRegistryInfo?
    let verificationChecks: [VerificationCheck]
}

struct TrustRegistryInfo {
    let name: String
    let verifiedSince: Date
    let accreditation: String?
}

struct VerificationCheck {
    let name: String
    let passed: Bool
}

#Preview {
    IssuerAuthenticityModal(
        issuer: Issuer(id: "did:example:issuer", name: "Test Issuer", image: nil),
        isPresented: .constant(true)
    )
}

