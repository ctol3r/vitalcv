//
//  CredentialDetailView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 13
//  VC detail modal
//

import SwiftUI
import Combine

struct CredentialDetailView: View {
    let credential: VerifiableCredential
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel: CredentialDetailViewModel
    @State private var showingQRShare = false
    @State private var showingVerification = false
    @State private var verificationResult: VerificationResult?
    @State private var isVerifying = false

    init(credential: VerifiableCredential) {
        self.credential = credential
        _viewModel = StateObject(wrappedValue: CredentialDetailViewModel(credential: credential))
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: WalletSpacing.lg) {
                    // Header card
                    headerCard

                    // Issuer authenticity badge
                    if let issuer = credential.issuer as? Issuer {
                        IssuerAuthenticityBadge(issuer: issuer)
                    }

                    // Human-readable view
                    HumanReadableCredentialView(credential: credential)

                    // Credential details
                    detailsSection

                    // Task 17: Timeline view (issued → anchored → verified)
                    timelineSection

                    // Task 18: Evidence collapsible section
                    if credential.evidence != nil && !credential.evidence!.isEmpty {
                        evidenceCollapsibleSection
                    }

                    // Task 19: Chain anchor status indicator
                    chainAnchorSection

                    // Task 20: Issuer authenticity stamp
                    issuerAuthenticitySection

                    // Selective disclosure
                    Button(action: {
                        // Show selective disclosure view
                    }) {
                        HStack {
                            Image(systemName: "eye.slash.fill")
                            Text("Selective Disclosure")
                                .font(WalletTypography.headline)
                        }
                        .foregroundColor(.walletPrimary)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary.opacity(0.1))
                        .cornerRadius(WalletCornerRadius.medium)
                    }

                    // Selective disclosure
                    NavigationLink(destination: SelectiveDisclosureView(credential: credential)) {
                        HStack {
                            Image(systemName: "eye.slash.fill")
                            Text("Selective Disclosure")
                                .font(WalletTypography.headline)
                        }
                        .foregroundColor(.walletPrimary)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary.opacity(0.1))
                        .cornerRadius(WalletCornerRadius.medium)
                    }

                    // Actions
                    actionsSection
                }
                .padding(WalletSpacing.md)
            }
            .navigationTitle("Credential Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingQRShare) {
                QRShareView(credential: credential)
            }
            .sheet(isPresented: $showingVerification) {
                if let result = verificationResult {
                    VerificationResultView(result: result)
                }
            }
        }
    }

    private var headerCard: some View {
        VStack(spacing: WalletSpacing.md) {
            // Issuer badge
            HStack {
                if let issuerImage = credential.issuer.image {
                    AsyncImage(url: URL(string: issuerImage)) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                    } placeholder: {
                        Image(systemName: "building.2.fill")
                            .foregroundColor(.walletTextSecondary)
                    }
                    .frame(width: 48, height: 48)
                    .cornerRadius(WalletCornerRadius.medium)
                } else {
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.walletPrimary)
                }

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(credential.type.first ?? "Credential")
                        .font(WalletTypography.title2)
                        .foregroundColor(.walletText)

                    Text(credential.issuer.name ?? credential.issuer.id)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()
            }

            Divider()

            // Status and dates
            HStack {
                VStack(alignment: .leading) {
                    Text("Status")
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                    Text(credential.isExpired ? "Expired" : credential.isExpiringSoon ? "Expiring Soon" : "Active")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(credential.isExpired ? .walletError : credential.isExpiringSoon ? .walletWarning : .walletSuccess)
                }

                Spacer()

                VStack(alignment: .trailing) {
                    Text("Issued")
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                    Text(formatDate(credential.issuanceDate))
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletText)
                }
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Details")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            ForEach(Array(credential.credentialSubject.claims.keys.sorted()), id: \.self) { key in
                HStack {
                    Text(key.capitalized)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)

                    Spacer()

                    Text(credential.credentialSubject.claims[key] ?? "")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletText)
                }
                .padding(.vertical, WalletSpacing.xs)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    private func evidenceTimelineSection(evidence: [Evidence]) -> some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Evidence Timeline")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            ForEach(evidence) { item in
                EvidenceTimelineItem(evidence: item)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    private var actionsSection: some View {
        VStack(spacing: WalletSpacing.md) {
            // Verify button
            Button(action: {
                verifyCredential()
            }) {
                HStack {
                    if isVerifying {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "checkmark.shield.fill")
                    }
                    Text("Verify My Credential")
                        .font(WalletTypography.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isVerifying ? Color.gray : Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.medium)
            }
            .disabled(isVerifying)

            // Share QR button
            Button(action: {
                showingQRShare = true
            }) {
                HStack {
                    Image(systemName: "qrcode")
                    Text("Share Proof QR")
                        .font(WalletTypography.headline)
                }
                .foregroundColor(.walletPrimary)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.walletPrimary.opacity(0.1))
                .cornerRadius(WalletCornerRadius.medium)
            }
        }
    }

    @State private var cancellables = Set<AnyCancellable>()

    private func verifyCredential() {
        isVerifying = true
        NetworkService.shared.verifyCredential(credentialId: credential.id)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { completion in
                    isVerifying = false
                    if case .failure(let error) = completion {
                        print("Verification error: \(error)")
                    }
                },
                receiveValue: { result in
                    verificationResult = result
                    showingVerification = true
                }
            )
            .store(in: &cancellables)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

struct EvidenceTimelineItem: View {
    let evidence: Evidence

    var body: some View {
        HStack(alignment: .top, spacing: WalletSpacing.md) {
            Circle()
                .fill(Color.walletPrimary)
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(evidence.type)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                if let description = evidence.description {
                    Text(description)
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                }

                Text(formatDate(evidence.timestamp))
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    CredentialDetailView(
        credential: VerifiableCredential(
            id: "1",
            type: ["VerifiableCredential"],
            issuer: Issuer(id: "did:example:issuer", name: "Medical Board", image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(id: "did:example:holder", type: "Person", claims: ["name": "John Doe"]),
            proof: nil,
            evidence: nil
        )
    )
}

