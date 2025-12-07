//
//  SelectiveDisclosurePreviewView.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 28
//  Selective-disclosure preview (SD-JWT)
//

import SwiftUI

/// SelectiveDisclosurePreviewView - Preview of selective disclosure options for SD-JWT
struct SelectiveDisclosurePreviewView: View {
    let offer: CredentialOffer
    @State private var selectedFields: Set<String> = []
    @State private var disclosureMode: DisclosureMode = .selective

    enum DisclosureMode {
        case all
        case selective
        case minimal
    }

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.lg) {
            // Header
            Text("Selective Disclosure")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)

            Text("Choose which fields to disclose when sharing this credential")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)

            // Disclosure mode selector
            Picker("Mode", selection: $disclosureMode) {
                Text("All Fields").tag(DisclosureMode.all)
                Text("Selective").tag(DisclosureMode.selective)
                Text("Minimal").tag(DisclosureMode.minimal)
            }
            .pickerStyle(.segmented)
            .onChange(of: disclosureMode) { newMode in
                updateSelection(for: newMode)
            }

            // Field list
            ScrollView {
                VStack(spacing: WalletSpacing.sm) {
                    ForEach(offer.fields, id: \.key) { field in
                        DisclosureFieldRow(
                            field: field,
                            isSelected: selectedFields.contains(field.key),
                            isRequired: field.required
                        ) {
                            toggleField(field.key)
                        }
                    }
                }
            }

            // Summary
            disclosureSummary
        }
        .padding()
        .onAppear {
            initializeSelection()
        }
    }

    private func initializeSelection() {
        // Select required fields by default
        selectedFields = Set(offer.fields.filter { $0.required }.map { $0.key })
    }

    private func updateSelection(for mode: DisclosureMode) {
        switch mode {
        case .all:
            selectedFields = Set(offer.fields.map { $0.key })
        case .selective:
            selectedFields = Set(offer.fields.filter { $0.required }.map { $0.key })
        case .minimal:
            selectedFields = Set(offer.fields.filter { $0.required && $0.key == "name" }.map { $0.key })
        }
    }

    private func toggleField(_ key: String) {
        if selectedFields.contains(key) {
            // Don't allow deselecting required fields
            if let field = offer.fields.first(where: { $0.key == key }), !field.required {
                selectedFields.remove(key)
            }
        } else {
            selectedFields.insert(key)
        }
    }

    private var disclosureSummary: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Disclosure Summary")
                .font(WalletTypography.headline)
                .foregroundColor(.walletText)

            HStack {
                Text("\(selectedFields.count) of \(offer.fields.count) fields")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)

                Spacer()

                Image(systemName: "lock.shield.fill")
                    .foregroundColor(.walletPrimary)
            }

            Text("SD-JWT format will be used for selective disclosure")
                .font(WalletTypography.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

// MARK: - Disclosure Field Row

struct DisclosureFieldRow: View {
    let field: CredentialField
    let isSelected: Bool
    let isRequired: Bool
    let onToggle: () -> Void

    var body: some View {
        HStack {
            // Checkbox
            Button(action: onToggle) {
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .foregroundColor(isSelected ? .walletPrimary : .walletTextSecondary)
                    .font(.system(size: 24))
            }
            .disabled(isRequired)

            // Field info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(field.label)
                        .font(WalletTypography.body)
                        .foregroundColor(.walletText)

                    if isRequired {
                        Text("*")
                            .foregroundColor(.walletError)
                            .font(WalletTypography.caption)
                    }
                }

                Text(field.value)
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
                    .lineLimit(1)
            }

            Spacer()

            // Required indicator
            if isRequired {
                Text("Required")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.walletCard)
                    .cornerRadius(WalletCornerRadius.small)
            }
        }
        .padding()
        .background(isSelected ? Color.walletPrimary.opacity(0.1) : Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

#Preview {
    SelectiveDisclosurePreviewView(
        offer: CredentialOffer(
            id: "offer-1",
            issuer: Issuer(id: "did:example:issuer", name: "Test Issuer", image: nil),
            type: ["VerifiableCredential"],
            fields: [
                CredentialField(key: "name", label: "Full Name", value: "Dr. Jane Doe", required: true),
                CredentialField(key: "license", label: "License Number", value: "MD-12345", required: true),
                CredentialField(key: "specialty", label: "Specialty", value: "Cardiology", required: false),
                CredentialField(key: "email", label: "Email", value: "jane@example.com", required: false)
            ],
            trustMetadata: TrustMetadata(
                issuerVerified: true,
                chainAnchored: true,
                revocationCheck: true,
                expirationDate: nil
            )
        )
    )
    .padding()
    .background(Color.walletBackground)
}

