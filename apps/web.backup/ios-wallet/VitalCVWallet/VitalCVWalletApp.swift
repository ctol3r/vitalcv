//
//  VitalCVWalletApp.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 1
//  Updated: Batch 542 - Task 1, 4
//  SwiftUI project initialization with NavigationStack
//

import SwiftUI

@main
struct VitalCVWalletApp: App {
    @StateObject private var appState = AppStateContainer.shared
    @StateObject private var navigationCoordinator = NavigationCoordinator.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(navigationCoordinator)
                .onOpenURL { url in
                    // Handle deep links (Task 39)
                    if let action = DeepLinkHandler.shared.handleURL(url) {
                        handleDeepLinkAction(action)
                    }
                }
                .task {
                    // Initialize VitalCVKit (Batch 551 - Task 1)
                    await VitalCVKit.initialize()

                    // Auto-create DID on first open (Task 8)
                    if !appState.isAuthenticated && !DIDService.shared.hasDID() {
                        do {
                            let did = try await DIDService.shared.createDID()
                            await MainActor.run {
                                appState.authenticate(did: did)
                            }
                        } catch {
                            // Use unified error handler (Batch 551 - Task 4)
                            await MainActor.run {
                                ErrorHandler.shared.handle(error, context: "DID Creation")
                            }
                        }
                    }

                    // Check security status
                    let securityStatus = SecurityService.shared.checkAppIntegrity()
                    if securityStatus == .compromised {
                        // Show security warning via error handler
                        await MainActor.run {
                            ErrorHandler.shared.handle(
                                NSError(domain: "Security", code: 1, userInfo: [NSLocalizedDescriptionKey: "Device may be compromised"]),
                                message: "Security Warning: Your device may be compromised. Please use a secure device."
                            )
                        }
                    }
                }
                .errorAlert() // Batch 551 - Task 4: Error alert modifier
        }
    }

    private func handleDeepLinkAction(_ action: DeepLinkAction) {
        switch action {
        case .credentialDetail(let id):
            navigationCoordinator.navigate(to: .credentialDetail(id: id))
        case .verifyCredential(let id):
            navigationCoordinator.navigate(to: .verifyCredential(id: id))
        case .jobApplication(let id):
            navigationCoordinator.navigate(to: .jobApplication(id: id))
        case .recruiterConnect(let id):
            navigationCoordinator.presentSheet(.recruiterConnect(id: id))
        case .credentialOffer(let url):
            // Phase 1 - Task 4: Handle credential offer deep link
            navigationCoordinator.presentSheet(.credentialOffer(url: url))
        case .scan:
            navigationCoordinator.presentSheet(.scan)
        case .scheduler(let shiftId):
            // Phase 5 - Task 38: Handle scheduler deep link
            navigationCoordinator.navigate(to: .scheduler(shiftId: shiftId))
        case .zkAuthorize(let url):
            // Phase 1 - Task 8: Handle ZK authorization deep link
            navigationCoordinator.presentSheet(.zkAuthorize(url: url))
        }
    }
}

