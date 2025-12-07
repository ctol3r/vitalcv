//
//  DIDGenerationView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 8
//  DID generation screen
//

import SwiftUI

struct DIDGenerationView: View {
    @EnvironmentObject var appState: AppStateContainer
    @Environment(\.dismiss) var dismiss
    @State private var generatedDID: String?
    @State private var isGenerating = false
    @State private var showingBackup = false

    var body: some View {
        NavigationView {
            VStack(spacing: WalletSpacing.xl) {
                if let did = generatedDID {
                    // DID generated successfully
                    successView(did: did)
                } else {
                    // Generation in progress
                    generatingView
                }
            }
            .padding(WalletSpacing.lg)
            .navigationTitle("Create Digital Identity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if generatedDID == nil {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Cancel") {
                            dismiss()
                        }
                    }
                }
            }
            .onAppear {
                generateDID()
            }
        }
    }

    private var generatingView: some View {
        VStack(spacing: WalletSpacing.xl) {
            Spacer()

            ProgressView()
                .scaleEffect(2)
                .padding(.bottom, WalletSpacing.lg)

            Text("Generating your Digital Identity")
                .font(WalletTypography.title2)
                .foregroundColor(.walletText)

            Text("This may take a few moments...")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)

            Spacer()
        }
    }

    private func successView(did: String) -> some View {
        VStack(spacing: WalletSpacing.xl) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.walletSuccess)
                .padding(.top, WalletSpacing.xl)

            Text("Digital Identity Created")
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                Text("Your DID:")
                    .font(WalletTypography.caption1)
                    .foregroundColor(.walletTextSecondary)

                Text(did)
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.walletText)
                    .padding()
                    .background(Color.walletCard)
                    .cornerRadius(WalletCornerRadius.medium)
                    .walletShadow(WalletShadow.small)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text("Save this DID securely. You'll need it to access your credentials.")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)

            Spacer()

            VStack(spacing: WalletSpacing.md) {
                Button(action: {
                    showingBackup = true
                }) {
                    HStack {
                        Image(systemName: "square.and.arrow.down")
                        Text("Backup DID")
                            .font(WalletTypography.headline)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.medium)
                }

                Button(action: {
                    appState.authenticate(did: did)
                    dismiss()
                }) {
                    Text("Continue")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletPrimary)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletPrimary.opacity(0.1))
                        .cornerRadius(WalletCornerRadius.medium)
                }
            }
        }
        .sheet(isPresented: $showingBackup) {
            DIDBackupView(did: did)
        }
    }

    private func generateDID() {
        isGenerating = true

        // Generate DID using did:key method
        // In production, this would use a proper DID library
        DispatchQueue.global(qos: .userInitiated).async {
            // Simulate DID generation
            Thread.sleep(forTimeInterval: 1.5)

            // Generate a mock DID (in production, use proper DID generation)
            let timestamp = Int(Date().timeIntervalSince1970)
            let random = Int.random(in: 1000...9999)
            let did = "did:vital:\(timestamp)\(random)"

            DispatchQueue.main.async {
                generatedDID = did
                isGenerating = false
            }
        }
    }
}

#Preview {
    DIDGenerationView()
        .environmentObject(AppStateContainer.shared)
}

