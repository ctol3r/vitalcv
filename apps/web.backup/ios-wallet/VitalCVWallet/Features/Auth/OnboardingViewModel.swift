//
//  OnboardingViewModel.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 6, 7
//  Onboarding view model with DID creation and skip option
//

import Foundation
import SwiftUI
import VitalCVKit

@MainActor
class OnboardingViewModel: ObservableObject {
    @Published var currentPage = 0
    @Published var isCreatingDID = false
    @Published var error: String?

    private let didService = DIDService.shared

    func nextPage() {
        if currentPage < 2 {
            currentPage += 1
        }
    }

    func previousPage() {
        if currentPage > 0 {
            currentPage -= 1
        }
    }

    func createDID() async {
        isCreatingDID = true
        error = nil

        do {
            let did = try await didService.createDID()

            // Notify app state
            NotificationCenter.default.post(
                name: .didCreated,
                object: nil,
                userInfo: ["did": did]
            )

            isCreatingDID = false
        } catch {
            self.error = error.localizedDescription
            isCreatingDID = false
        }
    }

    func skipAccountCreation() {
        // Task 12: Skip onboarding but still generate DID in background
        // Allow user to continue without waiting, but generate DID asynchronously
        NotificationCenter.default.post(
            name: .onboardingSkipped,
            object: nil
        )

        // Generate DID in background without blocking UI
        Task.detached(priority: .background) {
            do {
                let did = try await DIDService.shared.createDID()
                await MainActor.run {
                    NotificationCenter.default.post(
                        name: .didCreated,
                        object: nil,
                        userInfo: ["did": did]
                    )
                }
            } catch {
                // Silently fail - user can create DID later from settings
                await MainActor.run {
                    Logger.shared.log(
                        "Background DID creation failed: \(error.localizedDescription)",
                        level: .warning
                    )
                }
            }
        }
    }
}

extension Notification.Name {
    static let didCreated = Notification.Name("didCreated")
    static let onboardingSkipped = Notification.Name("onboardingSkipped")
}
