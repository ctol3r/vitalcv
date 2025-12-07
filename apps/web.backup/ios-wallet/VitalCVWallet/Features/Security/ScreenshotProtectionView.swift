//
//  ScreenshotProtectionView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 36
//  Screenshot protection overlay
//

import SwiftUI

struct ScreenshotProtectionView: ViewModifier {
    @State private var showingAlert = false

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.userDidTakeScreenshotNotification)) { _ in
                // Screenshot detected
                showingAlert = true

                // Optionally blur sensitive content
                // In production, hide or blur sensitive information
            }
            .alert("Screenshot Detected", isPresented: $showingAlert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("For security, please avoid taking screenshots of sensitive credential information.")
            }
    }
}

extension View {
    func screenshotProtected() -> some View {
        modifier(ScreenshotProtectionView())
    }
}








