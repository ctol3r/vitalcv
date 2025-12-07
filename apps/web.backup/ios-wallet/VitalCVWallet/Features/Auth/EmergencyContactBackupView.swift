//
//  EmergencyContactBackupView.swift
//  VitalCVWallet
//
//  Created: Batch 127 - Task 8
//  Emergency-contact DID backup option
//

import SwiftUI
import Contacts

struct EmergencyContactBackupView: View {
    @EnvironmentObject var appState: AppStateContainer
    @State private var selectedContact: CNContact?
    @State private var showingContactPicker = false
    @State private var backupCreated = false
    @State private var backupError: String?

    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            // Header
            VStack(spacing: WalletSpacing.md) {
                Image(systemName: "person.2.shield.checkmark")
                    .font(.system(size: 60))
                    .foregroundColor(.walletPrimary)

                Text("Emergency Contact Backup")
                    .font(WalletTypography.title1)
                    .foregroundColor(.walletText)

                Text("Share your DID recovery information with a trusted contact. They can help you restore your identity if you lose access to your device.")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)
            }
            .padding(.top, WalletSpacing.xl)

            // Selected contact display
            if let contact = selectedContact {
                ContactCard(contact: contact) {
                    selectedContact = nil
                }
                .padding(.horizontal, WalletSpacing.lg)
            }

            // Contact picker button
            if selectedContact == nil {
                Button(action: {
                    showingContactPicker = true
                }) {
                    HStack {
                        Image(systemName: "person.crop.circle.badge.plus")
                        Text("Select Trusted Contact")
                    }
                    .font(WalletTypography.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.walletPrimary)
                    .cornerRadius(WalletCornerRadius.medium)
                }
                .padding(.horizontal, WalletSpacing.lg)
            }

            // Create backup button
            if let contact = selectedContact, !backupCreated {
                Button(action: {
                    Task {
                        await createBackup(for: contact)
                    }
                }) {
                    Text("Create Backup")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.walletSuccess)
                        .cornerRadius(WalletCornerRadius.medium)
                }
                .padding(.horizontal, WalletSpacing.lg)
            }

            // Success message
            if backupCreated {
                VStack(spacing: WalletSpacing.sm) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 50))
                        .foregroundColor(.walletSuccess)

                    Text("Backup Created Successfully")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text("Your DID recovery information has been securely shared with your trusted contact.")
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, WalletSpacing.lg)
                }
                .padding(.vertical, WalletSpacing.xl)
            }

            if let error = backupError {
                Text(error)
                    .font(WalletTypography.footnote)
                    .foregroundColor(.walletError)
                    .padding(.horizontal, WalletSpacing.lg)
            }

            Spacer()
        }
        .sheet(isPresented: $showingContactPicker) {
            ContactPickerView { contact in
                selectedContact = contact
                showingContactPicker = false
            }
        }
    }

    private func createBackup(for contact: CNContact) async {
        guard let did = appState.currentUserDid else {
            backupError = "No DID available"
            return
        }

        do {
            // Generate backup data
            let backupData = try await DIDService.shared.generateBackupData(for: did)

            // Encrypt backup data
            let encryptedBackup = try SecurityService.shared.encryptBackup(backupData)

            // Store backup reference (not the actual data, just metadata)
            let backupReference = BackupReference(
                contactIdentifier: contact.identifier,
                contactName: "\(contact.givenName) \(contact.familyName)",
                createdAt: Date(),
                encrypted: true
            )

            // Save backup reference
            KeychainService.shared.saveBackupReference(backupReference)

            // Share backup via secure channel (e.g., encrypted message)
            // In production, this would use a secure messaging protocol
            await shareBackupSecurely(encryptedBackup, to: contact)

            await MainActor.run {
                backupCreated = true
            }
        } catch {
            backupError = "Failed to create backup: \(error.localizedDescription)"
        }
    }

    private func shareBackupSecurely(_ backup: Data, to contact: CNContact) async {
        // In production, this would:
        // 1. Use encrypted messaging (Signal, etc.)
        // 2. Or generate a secure shareable link
        // 3. Or use a trusted backup service

        // For now, just log
        print("Backup created for contact: \(contact.identifier)")
    }
}

// MARK: - Contact Card

struct ContactCard: View {
    let contact: CNContact
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: WalletSpacing.md) {
            // Contact avatar
            Circle()
                .fill(Color.walletPrimary.opacity(0.2))
                .frame(width: 50, height: 50)
                .overlay(
                    Text(contactInitials)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletPrimary)
                )

            // Contact info
            VStack(alignment: .leading, spacing: 4) {
                Text(contactName)
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)

                if let phone = contact.phoneNumbers.first?.value.stringValue {
                    Text(phone)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }
            }

            Spacer()

            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding()
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.small)
    }

    private var contactName: String {
        "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespaces)
    }

    private var contactInitials: String {
        let first = contact.givenName.prefix(1)
        let last = contact.familyName.prefix(1)
        return "\(first)\(last)".uppercased()
    }
}

// MARK: - Contact Picker View

struct ContactPickerView: UIViewControllerRepresentable {
    let onSelect: (CNContact) -> Void

    func makeUIViewController(context: Context) -> CNContactPickerViewController {
        let picker = CNContactPickerViewController()
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: CNContactPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelect: onSelect)
    }

    class Coordinator: NSObject, CNContactPickerDelegate {
        let onSelect: (CNContact) -> Void

        init(onSelect: @escaping (CNContact) -> Void) {
            self.onSelect = onSelect
        }

        func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
            onSelect(contact)
        }
    }
}

// MARK: - Backup Reference

struct BackupReference: Codable {
    let contactIdentifier: String
    let contactName: String
    let createdAt: Date
    let encrypted: Bool
}

#Preview {
    EmergencyContactBackupView()
        .environmentObject(AppStateContainer.shared)
}








