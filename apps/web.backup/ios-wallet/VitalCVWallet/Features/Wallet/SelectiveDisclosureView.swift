//
//  SelectiveDisclosureView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 18
//  Selective disclosure toggle
//

import SwiftUI

struct SelectiveDisclosureView: View {
    let credential: VerifiableCredential
    @State private var disclosureOptions: [String: Bool] = [:]
    @State private var generatedPresentation: String?
    @State private var sdjwtDisclosures: [SDJWTDisclosure] = []
    @State private var showingPreview = false
    @State private var privacyAnimationTrigger = false
    @Environment(\.dismiss) var dismiss

    private let sdjwtEngine = SDJWTEngine.shared

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    // Header
                    headerSection

                    // Disclosure options
                    disclosureOptionsSection

                    // Generate button
                    generateButton
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Selective Disclosure")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                initializeDisclosureOptions()
            }
            .sheet(isPresented: $showingPreview) {
                if let presentation = generatedPresentation {
                    SelectiveDisclosurePreviewView(
                        presentation: presentation,
                        disclosures: sdjwtDisclosures,
                        revealedCount: disclosureOptions.values.filter { $0 }.count,
                        hiddenCount: disclosureOptions.count - disclosureOptions.values.filter { $0 }.count
                    )
                }
            }
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Choose what to share")
                .font(WalletTypography.title2)
                .foregroundColor(.walletText)

            Text("Select which attributes from this credential you want to include in the verifiable presentation.")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
        }
    }

    private var disclosureOptionsSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Attributes")
                .font(WalletTypography.title3)
                .foregroundColor(.walletText)

            ForEach(Array(disclosureOptions.keys.sorted()), id: \.self) { key in
                let isRevealed = disclosureOptions[key] ?? false
                DisclosureToggleWithBadge(
                    label: key.capitalized,
                    value: credential.credentialSubject.claims[key] ?? "",
                    isEnabled: Binding(
                        get: { disclosureOptions[key] ?? false },
                        set: {
                            disclosureOptions[key] = $0
                            // Task 19: Privacy protection animation
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                privacyAnimationTrigger.toggle()
                            }
                        }
                    ),
                    isRevealed: isRevealed,
                    disclosure: sdjwtDisclosures.first { $0.claimKey == key }
                )
            }

            // Task 17: Disclosed vs Hidden badge system
            disclosureSummaryBadges
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    private var disclosureSummaryBadges: some View {
        HStack(spacing: WalletSpacing.sm) {
            let revealedCount = disclosureOptions.values.filter { $0 }.count
            let hiddenCount = disclosureOptions.count - revealedCount

            BadgeView(
                label: "Revealed",
                count: revealedCount,
                color: .walletSuccess
            )

            BadgeView(
                label: "Hidden",
                count: hiddenCount,
                color: .walletTextSecondary
            )
        }
        .padding(.top, WalletSpacing.sm)
    }

    private var generateButton: some View {
        Button(action: {
            generatePresentation()
        }) {
            HStack {
                Image(systemName: "checkmark.shield.fill")
                Text("Generate Verifiable Presentation")
                    .font(WalletTypography.headline)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(hasSelectedAttributes ? Color.walletPrimary : Color.gray)
            .cornerRadius(WalletCornerRadius.medium)
        }
        .disabled(!hasSelectedAttributes)
    }

    private var hasSelectedAttributes: Bool {
        disclosureOptions.values.contains(true)
    }

    private func initializeDisclosureOptions() {
        for key in credential.credentialSubject.claims.keys {
            disclosureOptions[key] = false
        }
    }

    private func generatePresentation() {
        // Task 16: UI for attribute selection (checkbox-like reveal)
        // Task 18: Add salt + digests handling for SD-JWT
        let revealedClaims = disclosureOptions
            .filter { $0.value }
            .map { $0.key }

        // Generate SD-JWT disclosures for revealed claims
        var disclosures: [SDJWTDisclosure] = []
        for claimKey in revealedClaims {
            if let claimValue = credential.credentialSubject.claims[claimKey] {
                let salt = sdjwtEngine.generateSalt()
                let disclosure = sdjwtEngine.createDisclosure(
                    salt: salt,
                    claimKey: claimKey,
                    claimValue: claimValue
                )
                disclosures.append(disclosure)
            }
        }

        sdjwtDisclosures = disclosures

        // Task 19: Add selective disclosure preview
        showingPreview = true

        // Generate presentation with SD-JWT
        let selectedClaims = disclosureOptions
            .filter { $0.value }
            .compactMapValues { key in
                credential.credentialSubject.claims[key]
            }

        let presentation: [String: Any] = [
            "type": "VerifiablePresentation",
            "verifiableCredential": [
                "id": credential.id,
                "type": credential.type,
                "issuer": credential.issuer.id,
                "credentialSubject": [
                    "id": credential.credentialSubject.id,
                    "claims": selectedClaims
                ],
                "sdjwt_disclosures": disclosures.map { [
                    "salt": $0.salt,
                    "claim_key": $0.claimKey,
                    "claim_value": $0.claimValue,
                    "digest": $0.digest
                ]}
            ]
        ]

        if let jsonData = try? JSONSerialization.data(withJSONObject: presentation, options: .prettyPrinted),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            generatedPresentation = jsonString
        }
    }
}

struct DisclosureToggle: View {
    let label: String
    let value: String
    @Binding var isEnabled: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                Text(label)
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Text(value)
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)
                    .lineLimit(2)
            }

            Spacer()

            Toggle("", isOn: $isEnabled)
                .labelsHidden()
        }
        .padding(WalletSpacing.sm)
        .background(isEnabled ? Color.walletPrimary.opacity(0.1) : Color.clear)
        .cornerRadius(WalletCornerRadius.small)
    }
}

// Task 16: Enhanced disclosure toggle with badges
struct DisclosureToggleWithBadge: View {
    let label: String
    let value: String
    @Binding var isEnabled: Bool
    let isRevealed: Bool
    let disclosure: SDJWTDisclosure?

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            HStack {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(label)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletText)

                    Text(value)
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletTextSecondary)
                        .lineLimit(2)
                }

                Spacer()

                Toggle("", isOn: $isEnabled)
                    .labelsHidden()
            }

            // Task 17: Disclosed vs Hidden badge
            HStack {
                if isRevealed {
                    Label("Revealed", systemImage: "eye.fill")
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletSuccess)
                        .padding(.horizontal, WalletSpacing.xs)
                        .padding(.vertical, 2)
                        .background(Color.walletSuccess.opacity(0.1))
                        .cornerRadius(4)
                } else {
                    Label("Hidden", systemImage: "eye.slash.fill")
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletTextSecondary)
                        .padding(.horizontal, WalletSpacing.xs)
                        .padding(.vertical, 2)
                        .background(Color.walletTextSecondary.opacity(0.1))
                        .cornerRadius(4)
                }

                if let disclosure = disclosure {
                    Text("Digest: \(disclosure.digest.prefix(8))...")
                        .font(WalletTypography.caption2)
                        .foregroundColor(.walletTextSecondary)
                        .fontDesign(.monospaced)
                }
            }
        }
        .padding(WalletSpacing.sm)
        .background(isEnabled ? Color.walletPrimary.opacity(0.1) : Color.clear)
        .cornerRadius(WalletCornerRadius.small)
    }
}

// Task 17: Badge view component
struct BadgeView: View {
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        HStack(spacing: WalletSpacing.xs) {
            Text(label)
                .font(WalletTypography.caption2)
            Text("\(count)")
                .font(WalletTypography.caption2)
                .fontWeight(.semibold)
        }
        .foregroundColor(color)
        .padding(.horizontal, WalletSpacing.sm)
        .padding(.vertical, WalletSpacing.xs)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

// Task 19: Selective disclosure preview
struct SelectiveDisclosurePreviewView: View {
    let presentation: String
    let disclosures: [SDJWTDisclosure]
    let revealedCount: Int
    let hiddenCount: Int
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.lg) {
                    // Summary
                    VStack(alignment: .leading, spacing: WalletSpacing.md) {
                        Text("Preview")
                            .font(WalletTypography.title2)
                            .foregroundColor(.walletText)

                        HStack(spacing: WalletSpacing.md) {
                            BadgeView(label: "Revealed", count: revealedCount, color: .walletSuccess)
                            BadgeView(label: "Hidden", count: hiddenCount, color: .walletTextSecondary)
                        }
                    }

                    // Disclosures
                    if !disclosures.isEmpty {
                        VStack(alignment: .leading, spacing: WalletSpacing.md) {
                            Text("Revealed Attributes")
                                .font(WalletTypography.headline)
                                .foregroundColor(.walletText)

                            ForEach(disclosures, id: \.digest) { disclosure in
                                DisclosurePreviewCard(disclosure: disclosure)
                            }
                        }
                    }

                    // Presentation JSON
                    VStack(alignment: .leading, spacing: WalletSpacing.md) {
                        Text("Presentation")
                            .font(WalletTypography.headline)
                            .foregroundColor(.walletText)

                        Text(presentation)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.walletText)
                            .padding()
                            .background(Color.walletCard)
                            .cornerRadius(WalletCornerRadius.medium)
                    }
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct DisclosurePreviewCard: View {
    let disclosure: SDJWTDisclosure

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text(disclosure.claimKey.capitalized)
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletText)

            Text(disclosure.claimValue)
                .font(WalletTypography.caption1)
                .foregroundColor(.walletTextSecondary)

            Text("Salt: \(disclosure.salt.prefix(12))...")
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
                .fontDesign(.monospaced)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
    }
}

struct DisclosureResultView: View {
    let presentation: String
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: WalletSpacing.md) {
                    Text("Verifiable Presentation")
                        .font(WalletTypography.title2)
                        .foregroundColor(.walletText)

                    Text(presentation)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(.walletText)
                        .padding()
                        .background(Color.walletCard)
                        .cornerRadius(WalletCornerRadius.medium)
                        .walletShadow(WalletShadow.small)

                    Button(action: {
                        UIPasteboard.general.string = presentation
                    }) {
                        HStack {
                            Image(systemName: "doc.on.doc")
                            Text("Copy to Clipboard")
                                .font(WalletTypography.headline)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary)
                        .cornerRadius(WalletCornerRadius.medium)
                    }
                }
                .padding(WalletSpacing.lg)
            }
            .navigationTitle("Presentation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    SelectiveDisclosureView(
        credential: VerifiableCredential(
            id: "1",
            type: ["Credential"],
            issuer: Issuer(id: "did:example", name: nil, image: nil),
            issuanceDate: Date(),
            expirationDate: nil,
            credentialSubject: CredentialSubject(
                id: "did:holder",
                type: nil,
                claims: [
                    "name": "John Doe",
                    "email": "john@example.com",
                    "license": "MD12345"
                ]
            ),
            proof: nil,
            evidence: nil
        )
    )
}

