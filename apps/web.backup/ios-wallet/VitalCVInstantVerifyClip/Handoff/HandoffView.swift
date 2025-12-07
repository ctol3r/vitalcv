//
//  HandoffView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Phase 5 - Tasks 37, 38
//  Handoff to full app with animation transition
//

import SwiftUI
import UIKit

struct HandoffView: View {
    @EnvironmentObject var clipState: AppClipState
    @Environment(\.dismiss) var dismiss
    @State private var isTransitioning = false

    var body: some View {
        VStack(spacing: 24) {
            Text("Opening in VitalCV App...")
                .font(WalletTypography.title)

            ProgressView()
                .progressViewStyle(CircularProgressViewStyle())

            Text("Your verification result will be available in the full app")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .onAppear {
            performHandoff()
        }
    }

    private func performHandoff() {
        // Task 37: Pass handoffData to full app
        guard let handoffURL = clipState.prepareForFullAppTransition() else {
            return
        }

        // Task 38: Animation transition
        withAnimation(.easeInOut(duration: 0.3)) {
            isTransitioning = true
        }

        // Open full app
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if UIApplication.shared.canOpenURL(handoffURL) {
                UIApplication.shared.open(handoffURL)
            }
            dismiss()
        }
    }
}

