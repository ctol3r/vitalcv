//
//  VitalCVButtonStyles.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 6
//  Button styles: Primary, Ghost, Icon
//

import SwiftUI

// MARK: - Primary Button Style

struct PrimaryButtonStyle: ButtonStyle {
    var isEnabled: Bool = true
    var size: ButtonSize = .medium

    enum ButtonSize {
        case small
        case medium
        case large

        var padding: EdgeInsets {
            switch self {
            case .small:
                return EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
            case .medium:
                return EdgeInsets(top: 12, leading: 24, bottom: 12, trailing: 24)
            case .large:
                return EdgeInsets(top: 16, leading: 32, bottom: 16, trailing: 32)
            }
        }

        var font: Font {
            switch self {
            case .small:
                return .subheadline.weight(.semibold)
            case .medium:
                return .body.weight(.semibold)
            case .large:
                return .title3.weight(.semibold)
            }
        }
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundColor(isEnabled ? .white : .gray)
            .padding(size.padding)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(isEnabled ? Color.walletPrimary : Color.gray.opacity(0.3))
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Ghost Button Style

struct GhostButtonStyle: ButtonStyle {
    var isEnabled: Bool = true
    var size: PrimaryButtonStyle.ButtonSize = .medium

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundColor(isEnabled ? Color.walletPrimary : .gray)
            .padding(size.padding)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .stroke(isEnabled ? Color.walletPrimary : Color.gray.opacity(0.3), lineWidth: 1.5)
                    .background(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .fill(isEnabled ? Color.walletPrimary.opacity(configuration.isPressed ? 0.1 : 0.0) : Color.clear)
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Icon Button Style

struct IconButtonStyle: ButtonStyle {
    var size: IconSize = .medium
    var color: Color = .walletPrimary

    enum IconSize {
        case small
        case medium
        case large

        var frameSize: CGFloat {
            switch self {
            case .small: return 32
            case .medium: return 44
            case .large: return 56
            }
        }

        var iconSize: CGFloat {
            switch self {
            case .small: return 16
            case .medium: return 20
            case .large: return 24
            }
        }
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: size.iconSize, weight: .medium))
            .foregroundColor(color)
            .frame(width: size.frameSize, height: size.frameSize)
            .background(
                Circle()
                    .fill(color.opacity(configuration.isPressed ? 0.2 : 0.1))
            )
            .scaleEffect(configuration.isPressed ? 0.9 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - View Extensions

extension View {
    /// Apply primary button style
    func primaryButton(size: PrimaryButtonStyle.ButtonSize = .medium, isEnabled: Bool = true) -> some View {
        self.buttonStyle(PrimaryButtonStyle(isEnabled: isEnabled, size: size))
    }

    /// Apply ghost button style
    func ghostButton(size: PrimaryButtonStyle.ButtonSize = .medium, isEnabled: Bool = true) -> some View {
        self.buttonStyle(GhostButtonStyle(isEnabled: isEnabled, size: size))
    }

    /// Apply icon button style
    func iconButton(size: IconButtonStyle.IconSize = .medium, color: Color = .walletPrimary) -> some View {
        self.buttonStyle(IconButtonStyle(size: size, color: color))
    }
}

// MARK: - Trust-Aware Button Styles

struct TrustPrimaryButtonStyle: ButtonStyle {
    var trustLevel: TrustLevel
    var size: PrimaryButtonStyle.ButtonSize = .medium

    enum TrustLevel {
        case high
        case medium
        case low

        var color: Color {
            switch self {
            case .high: return .walletSuccess
            case .medium: return .walletWarning
            case .low: return .walletError
            }
        }
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundColor(.white)
            .padding(size.padding)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(trustLevel.color)
            )
            .overlay(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .stroke(trustLevel.color.opacity(0.3), lineWidth: 2)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

extension View {
    /// Apply trust-aware primary button style
    func trustPrimaryButton(level: TrustPrimaryButtonStyle.TrustLevel, size: PrimaryButtonStyle.ButtonSize = .medium) -> some View {
        self.buttonStyle(TrustPrimaryButtonStyle(trustLevel: level, size: size))
    }
}








