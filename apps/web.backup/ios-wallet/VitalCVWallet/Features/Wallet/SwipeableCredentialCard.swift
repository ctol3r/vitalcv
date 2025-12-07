//
//  SwipeableCredentialCard.swift
//  VitalCVWallet
//
//  Created: ARC A - Tasks 19-20
//  Swipeable credential card with Quick Verify and Quick Actions
//

import SwiftUI

/// SwipeableCredentialCard - Card with swipe gestures for quick actions
struct SwipeableCredentialCard: View {
    let item: CredentialListItem
    let onTap: () -> Void
    let onQuickVerify: () -> Void
    let onRenew: () -> Void
    let onUpdate: () -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var isShowingActions = false

    private let swipeThreshold: CGFloat = 100

    var body: some View {
        ZStack(alignment: .trailing) {
            // Task 19: Swipe right → Quick Verify
            if dragOffset > 0 {
                QuickVerifyActionView()
                    .frame(width: abs(dragOffset))
            }

            // Task 20: Swipe left → Quick Actions
            if dragOffset < 0 {
                QuickActionsView(
                    onRenew: onRenew,
                    onUpdate: onUpdate
                )
                .frame(width: abs(dragOffset))
            }

            // Main card
            CredentialCardContainer(item: item, onTap: onTap)
                .offset(x: dragOffset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            dragOffset = value.translation.x
                        }
                        .onEnded { value in
                            handleSwipeEnd(translation: value.translation.x, velocity: value.predictedEndTranslation.x)
                        }
                )
        }
    }

    private func handleSwipeEnd(translation: CGFloat, velocity: CGFloat) {
        if translation > swipeThreshold || velocity > 500 {
            // Swiped right - Quick Verify
            withAnimation(.spring()) {
                dragOffset = 0
            }
            onQuickVerify()
        } else if translation < -swipeThreshold || velocity < -500 {
            // Swiped left - Show Quick Actions
            withAnimation(.spring()) {
                dragOffset = -120
                isShowingActions = true
            }
        } else {
            // Spring back
            withAnimation(.spring()) {
                dragOffset = 0
                isShowingActions = false
            }
        }
    }
}

struct QuickVerifyActionView: View {
    var body: some View {
        HStack {
            Spacer()
            VStack {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.white)
                Text("Verify")
                    .font(WalletTypography.caption1)
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity)
            .background(Color.walletSuccess)
        }
    }
}

struct QuickActionsView: View {
    let onRenew: () -> Void
    let onUpdate: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onRenew) {
                VStack {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 20))
                    Text("Renew")
                        .font(WalletTypography.caption2)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .background(Color.walletPrimary)
            }

            Button(action: onUpdate) {
                VStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 20))
                    Text("Update")
                        .font(WalletTypography.caption2)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .background(Color.walletAccent)
            }
        }
    }
}

