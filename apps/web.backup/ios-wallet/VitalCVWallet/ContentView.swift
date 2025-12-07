//
//  ContentView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 1
//  Main content view
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppStateContainer
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator

    var body: some View {
        Group {
            if appState.isAuthenticated {
                WalletHomeView()
                    .safeAreaAdaptive(edges: .all, padding: WalletSpacing.md)
            } else {
                OnboardingView()
                    .safeAreaAdaptive(edges: .all, padding: WalletSpacing.md)
            }
        }
        .accessibilityContainer {
            // Full accessibility support
        }
        .sheet(item: $navigationCoordinator.presentedSheet) { destination in
            sheetContent(for: destination)
        }
    }

    @ViewBuilder
    private func sheetContent(for destination: SheetDestination) -> some View {
        switch destination {
        case .scan:
            ScanScreenView()
        case .qrShare(let credential):
            QRShareView(credential: credential)
        case .selectiveDisclosure(let credential):
            SelectiveDisclosureView(credential: credential)
        case .didBackup(let did):
            DIDBackupView(did: did)
        case .recruiterConnect(let id):
            RecruiterConnectView(recruiterId: id)
        case .credentialOffer(let url):
            // Phase 1 - Task 4: Show credential offer intake view
            CredentialOfferIntakeView(url: url)
        case .settings:
            SettingsView()
        case .zkAuthorize(let url):
            // Zero-Knowledge Authorization Engine - Phase 1 - Task 8: Show ZK authorization view
            ZKAuthView(url: url)
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppStateContainer.shared)
}

