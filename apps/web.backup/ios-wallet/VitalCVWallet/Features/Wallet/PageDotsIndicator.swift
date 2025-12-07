//
//  PageDotsIndicator.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 10
//  Animated page dots for wallet navigation
//

import SwiftUI

struct PageDotsIndicator: View {
    let currentPage: Int
    let totalPages: Int
    var dotSize: CGFloat = 8
    var spacing: CGFloat = 8
    var activeColor: Color = .walletPrimary
    var inactiveColor: Color = .walletTextSecondary

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<totalPages, id: \.self) { index in
                PageDot(
                    isActive: index == currentPage,
                    size: dotSize,
                    activeColor: activeColor,
                    inactiveColor: inactiveColor
                )
            }
        }
    }
}

struct PageDot: View {
    let isActive: Bool
    var size: CGFloat = 8
    var activeColor: Color = .walletPrimary
    var inactiveColor: Color = .walletTextSecondary

    @State private var scale: CGFloat = 1.0

    var body: some View {
        Circle()
            .fill(isActive ? activeColor : inactiveColor)
            .frame(width: isActive ? size * 1.5 : size, height: isActive ? size * 1.5 : size)
            .scaleEffect(scale)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isActive)
            .onChange(of: isActive) { newValue in
                if newValue {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                        scale = 1.2
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            scale = 1.0
                        }
                    }
                }
            }
    }
}

/// Page dots for tabbed navigation
struct TabPageDots: View {
    @Binding var selectedTab: Int
    let tabs: [String]

    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                VStack(spacing: WalletSpacing.xs) {
                    Text(tab)
                        .font(VitalCVFonts.caption1)
                        .foregroundColor(selectedTab == index ? .walletPrimary : .walletTextSecondary)

                    PageDot(
                        isActive: selectedTab == index,
                        size: 6,
                        activeColor: .walletPrimary,
                        inactiveColor: .walletTextSecondary
                    )
                }
                .onTapGesture {
                    withAnimation(.spring()) {
                        selectedTab = index
                    }
                    HapticFeedbackService.shared.selectionChanged()
                }
            }
        }
    }
}

