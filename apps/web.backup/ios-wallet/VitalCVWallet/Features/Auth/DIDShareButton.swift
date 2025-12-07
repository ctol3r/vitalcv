//
//  DIDShareButton.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 10
//  OS-level "copy VitalCV DID" share button
//

import SwiftUI
import UIKit

/// DIDShareButton - OS-level share button for VitalCV DID
struct DIDShareButton: View {
    let did: String
    @State private var showingShareSheet = false

    var body: some View {
        Button(action: {
            showingShareSheet = true
        }) {
            HStack {
                Image(systemName: "square.and.arrow.up")
                Text("Share DID")
            }
            .font(WalletTypography.headline)
            .foregroundColor(.walletPrimary)
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
        }
        .sheet(isPresented: $showingShareSheet) {
            ShareSheet(activityItems: [did])
        }
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]
    let applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: activityItems,
            applicationActivities: applicationActivities
        )
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {
        // No updates needed
    }
}

// MARK: - Copy to Clipboard Extension

extension View {
    func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text
    }
}

#Preview {
    DIDShareButton(did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK")
        .padding()
}

