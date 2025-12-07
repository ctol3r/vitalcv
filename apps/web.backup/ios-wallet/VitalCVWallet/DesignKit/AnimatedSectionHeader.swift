//
//  AnimatedSectionHeader.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 8
//  Animated section header component
//

import SwiftUI

/// AnimatedSectionHeader - Animated header for sections
struct AnimatedSectionHeader: View {
    let title: String
    let subtitle: String?
    let icon: String?
    var animationStyle: AnimationStyle = .fade
    var showDivider: Bool = true

    enum AnimationStyle {
        case fade
        case slide
        case scale
        case bounce
    }

    @State private var isVisible = false

    init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        animationStyle: AnimationStyle = .fade,
        showDivider: Bool = true
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.animationStyle = animationStyle
        self.showDivider = showDivider
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(.walletPrimary)
                        .opacity(isVisible ? 1 : 0)
                        .scaleEffect(isVisible ? 1 : 0.5)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(WalletTypography.title3)
                        .foregroundColor(.walletTextPrimary)
                        .opacity(isVisible ? 1 : 0)
                        .offset(x: isVisible ? 0 : (animationStyle == .slide ? -20 : 0))
                        .scaleEffect(isVisible ? 1 : (animationStyle == .scale ? 0.8 : 1))

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                            .opacity(isVisible ? 1 : 0)
                            .offset(x: isVisible ? 0 : (animationStyle == .slide ? -20 : 0))
                    }
                }

                Spacer()
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)

            if showDivider {
                Divider()
                    .opacity(isVisible ? 1 : 0)
            }
        }
        .onAppear {
            withAnimation(animationForStyle(animationStyle)) {
                isVisible = true
            }
        }
    }

    private func animationForStyle(_ style: AnimationStyle) -> Animation {
        switch style {
        case .fade:
            return .easeInOut(duration: 0.4)
        case .slide:
            return .spring(response: 0.5, dampingFraction: 0.7)
        case .scale:
            return .spring(response: 0.4, dampingFraction: 0.8)
        case .bounce:
            return .spring(response: 0.6, dampingFraction: 0.6)
        }
    }
}

// MARK: - Collapsible Section Header

struct CollapsibleSectionHeader: View {
    let title: String
    let subtitle: String?
    @Binding var isExpanded: Bool
    var icon: String? = nil

    var body: some View {
        Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isExpanded.toggle()
            }
        } label: {
            HStack(spacing: 12) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(.walletPrimary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(WalletTypography.title3)
                        .foregroundColor(.walletTextPrimary)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(WalletTypography.subheadline)
                            .foregroundColor(.walletTextSecondary)
                    }
                }

                Spacer()

                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.caption)
                    .foregroundColor(.walletTextSecondary)
                    .rotationEffect(.degrees(isExpanded ? 0 : 0))
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.vertical, WalletSpacing.sm)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Trust-Aware Section Header

struct TrustSectionHeader: View {
    let title: String
    let trustScore: Double
    var showTrustIndicator: Bool = true

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(WalletTypography.title3)
                    .foregroundColor(.walletTextPrimary)

                if showTrustIndicator {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(trustColor)
                            .frame(width: 8, height: 8)

                        Text("Trust: \(Int(trustScore * 100))%")
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal, WalletSpacing.md)
        .padding(.vertical, WalletSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                .fill(trustColor.opacity(0.1))
        )
    }

    private var trustColor: Color {
        if trustScore >= 0.8 {
            return .walletSuccess
        } else if trustScore >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }
}








