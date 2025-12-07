//
//  JobsFeedView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 41-45
//  Roles feed, Apply with VitalCV, recruiter connection, auto-fill, send-proof
//

import SwiftUI

struct JobsFeedView: View {
    @StateObject private var viewModel = JobsFeedViewModel()
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator

    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: WalletSpacing.md) {
                    // Task 41: Roles feed UI
                    ForEach(viewModel.roles) { role in
                        RoleCard(role: role) {
                            // Task 42: Apply with VitalCV button
                            navigationCoordinator.navigate(to: .applyWithCredential(
                                viewModel.selectedCredential ?? VerifiableCredential(
                                    id: "default",
                                    type: ["VerifiableCredential"],
                                    issuer: Issuer(id: "did:example", name: "Issuer", image: nil),
                                    issuanceDate: Date(),
                                    expirationDate: nil,
                                    credentialSubject: CredentialSubject(id: "did:example", type: "Person", claims: [:]),
                                    proof: nil,
                                    evidence: nil
                                )
                            ))
                        }
                    }
                }
                .padding(WalletSpacing.md)
            }
            .navigationTitle("Job Roles")
            .refreshable {
                await viewModel.loadRoles()
            }
            .task {
                await viewModel.loadRoles()
            }
        }
    }
}

struct RoleCard: View {
    let role: JobRole
    let onApply: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(role.title)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text(role.organization)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                Text(role.location)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
            }

            if let description = role.description {
                Text(description)
                    .font(WalletTypography.body)
                    .foregroundColor(.walletText)
                    .lineLimit(3)
            }

            // Task 42: Apply with VitalCV button
            Button(action: onApply) {
                HStack {
                    Image(systemName: "person.badge.plus")
                    Text("Apply with VitalCV")
                        .font(WalletTypography.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.medium)
            }
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }
}

struct JobRole: Identifiable, Codable {
    let id: String
    let title: String
    let organization: String
    let location: String
    let description: String?
    let recruiterId: String?
}

@MainActor
class JobsFeedViewModel: ObservableObject {
    @Published var roles: [JobRole] = []
    @Published var isLoading = false
    var selectedCredential: VerifiableCredential?

    func loadRoles() async {
        isLoading = true
        // In production, fetch from API
        // Mock data for now
        roles = [
            JobRole(
                id: "1",
                title: "Registered Nurse",
                organization: "City Hospital",
                location: "New York, NY",
                description: "Full-time RN position in emergency department",
                recruiterId: "recruiter-1"
            )
        ]
        isLoading = false
    }
}








