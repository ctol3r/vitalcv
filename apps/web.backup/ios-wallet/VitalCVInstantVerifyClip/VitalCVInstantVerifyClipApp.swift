//
//  VitalCVInstantVerifyClipApp.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 1 - Task 1
//  App Clip Entry Point
//

import SwiftUI

@main
struct VitalCVInstantVerifyClipApp: App {
    @StateObject private var clipState = AppClipState.shared

    var body: some Scene {
        WindowGroup {
            ClipEntryView()
                .environmentObject(clipState)
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { userActivity in
                    // Task 9: Handle invocation via universal link
                    handleInvocation(userActivity: userActivity)
                }
                .onOpenURL { url in
                    // Task 9: Handle invocation via URL scheme
                    handleInvocation(url: url)
                }
        }
    }

    // MARK: - Task 9: Invocation Handler

    private func handleInvocation(userActivity: NSUserActivity) {
        guard let url = userActivity.webpageURL else { return }
        handleInvocation(url: url)
    }

    private func handleInvocation(url: URL) {
        // Task 10: Parse inbound QR payload from invocation link
        clipState.handleInvocation(url: url)
    }
}




