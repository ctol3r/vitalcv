//
//  AllCredentialsView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 11
//  View all credentials
//

import SwiftUI

struct AllCredentialsView: View {
    @EnvironmentObject var appState: AppStateContainer
    @State private var selectedCredential: VerifiableCredential?
    @State private var showingDetail = false

    var body: some View {
        List {
            ForEach(appState.credentials) { credential in
                CredentialCard(credential: credential) {
                    selectedCredential = credential
                    showingDetail = true
                }
                .listRowInsets(EdgeInsets(top: WalletSpacing.sm, leading: WalletSpacing.md, bottom: WalletSpacing.sm, trailing: WalletSpacing.md))
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .navigationTitle("All Credentials")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showingDetail) {
            if let credential = selectedCredential {
                CredentialDetailView(credential: credential)
            }
        }
    }
}

#Preview {
    NavigationView {
        AllCredentialsView()
            .environmentObject(AppStateContainer.shared)
    }
}

