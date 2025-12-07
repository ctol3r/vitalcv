//
//  QuickActionsMenu.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 8
//  Quick actions (hold-to-reveal menu)
//

import SwiftUI

struct QuickActionsMenu: View {
    @State private var isPressed = false
    @State private var showMenu = false

    let actions: [QuickAction]

    struct QuickAction: Identifiable {
        let id = UUID()
        let icon: String
        let title: String
        let color: Color
        let action: () -> Void
    }

    var body: some View {
        ZStack {
            // Main button
            Button(action: {
                // Long press handled by gesture
            }) {
                HStack(spacing: WalletSpacing.sm) {
                    VitalCVIcon(
                        systemName: "ellipsis.circle.fill",
                        size: 24,
                        color: .walletPrimary
                    )
                    Text("Quick Actions")
                        .font(VitalCVFonts.subheadline)
                        .foregroundColor(.walletText)
                }
                .padding(WalletSpacing.md)
                .background(Color.walletCard)
                .cornerRadius(WalletCornerRadius.medium)
                .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                .scaleEffect(isPressed ? 0.95 : 1.0)
            }
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.3)
                    .onEnded { _ in
                        withAnimation(.spring()) {
                            showMenu = true
                        }
                        HapticFeedbackService.shared.longPress()
                    }
            )
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )

            // Menu overlay
            if showMenu {
                QuickActionsOverlay(
                    actions: actions,
                    onDismiss: {
                        withAnimation(.spring()) {
                            showMenu = false
                        }
                    }
                )
            }
        }
    }
}

struct QuickActionsOverlay: View {
    let actions: [QuickActionsMenu.QuickAction]
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            // Dimmer
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture {
                    onDismiss()
                }

            // Menu
            VStack(spacing: WalletSpacing.md) {
                ForEach(actions) { action in
                    QuickActionButton(
                        icon: action.icon,
                        title: action.title,
                        color: action.color,
                        action: {
                            action.action()
                            onDismiss()
                        }
                    )
                }
            }
            .padding(WalletSpacing.lg)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.large)
            .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
            .padding(WalletSpacing.xl)
        }
        .transition(.opacity.combined(with: .scale))
    }
}

struct QuickActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: WalletSpacing.md) {
                VitalCVIcon(
                    systemName: icon,
                    size: 24,
                    color: .white
                )
                Text(title)
                    .font(VitalCVFonts.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(WalletSpacing.md)
            .background(color)
            .cornerRadius(WalletCornerRadius.medium)
        }
    }
}

