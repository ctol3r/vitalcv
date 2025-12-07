//
//  ApplyWithCredentialView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 43-45
//  Recruiter connection, form auto-fill, send-proof-to-employer
//

import SwiftUI

struct ApplyWithCredentialView: View {
    let credential: VerifiableCredential
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = ApplyWithCredentialViewModel()

    var body: some View {
        NavigationView {
            Form {
                // Task 44: Full form auto-fill (pull from credentials)
                Section("Personal Information") {
                    TextField("Name", text: $viewModel.name)
                    TextField("Email", text: $viewModel.email)
                    TextField("Phone", text: $viewModel.phone)
                }

                Section("Professional Information") {
                    TextField("License Number", text: $viewModel.licenseNumber)
                    TextField("Specialty", text: $viewModel.specialty)
                }

                // Task 43: Recruiter connection
                Section("Recruiter") {
                    TextField("Recruiter Email", text: $viewModel.recruiterEmail)
                    Text("Connect with recruiter to streamline application")
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                }

                // Task 45: Send proof to employer
                Section("Verifiable Proof") {
                    Toggle("Include Verifiable Credential", isOn: $viewModel.includeProof)

                    if viewModel.includeProof {
                        CredentialProofPreview(credential: credential)
                    }
                }

                Button(action: {
                    viewModel.submitApplication()
                    dismiss()
                }) {
                    HStack {
                        Spacer()
                        Text("Submit Application")
                            .font(WalletTypography.headline)
                            .foregroundColor(.white)
                        Spacer()
                    }
                }
                .listRowBackground(Color.walletPrimary)
            }
            .navigationTitle("Apply with VitalCV")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                // Auto-fill from credential
                viewModel.autoFillFromCredential(credential)
            }
        }
    }
}

struct CredentialProofPreview: View {
    let credential: VerifiableCredential

    var body: some View {
        HStack {
            Image(systemName: "checkmark.shield.fill")
                .foregroundColor(.walletSuccess)

            VStack(alignment: .leading) {
                Text(credential.type.first ?? "Credential")
                    .font(WalletTypography.subheadline)

                Text("Issued by \(credential.issuer.name ?? credential.issuer.id)")
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
            }
        }
    }
}

@MainActor
class ApplyWithCredentialViewModel: ObservableObject {
    @Published var name: String = ""
    @Published var email: String = ""
    @Published var phone: String = ""
    @Published var licenseNumber: String = ""
    @Published var specialty: String = ""
    @Published var recruiterEmail: String = ""
    @Published var includeProof: Bool = true

    // Task 44: Auto-fill from credentials
    func autoFillFromCredential(_ credential: VerifiableCredential) {
        let claims = credential.credentialSubject.claims

        name = claims["name"] ?? claims["fullName"] ?? ""
        email = claims["email"] ?? ""
        phone = claims["phone"] ?? claims["phoneNumber"] ?? ""
        licenseNumber = claims["licenseNumber"] ?? claims["license"] ?? ""
        specialty = claims["specialty"] ?? claims["specialization"] ?? ""
    }

    func submitApplication() {
        // Task 45: Send proof to employer
        // In production, send application with verifiable credential proof
        print("Submitting application with credential proof...")
    }
}








