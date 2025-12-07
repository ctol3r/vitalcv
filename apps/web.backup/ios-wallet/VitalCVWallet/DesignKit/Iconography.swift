//
//  Iconography.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 4
//  Iconography system (SF Symbols + VitalCV glyphs)
//

import SwiftUI

/// VitalCV iconography system
struct VitalCVIcons {
    // MARK: - SF Symbols Categories

    /// Authentication & Security Icons
    struct Auth {
        static let fingerprint = "touchid"
        static let faceID = "faceid"
        static let lock = "lock.fill"
        static let unlock = "lock.open.fill"
        static let key = "key.fill"
        static let shield = "shield.fill"
        static let shieldCheck = "checkmark.shield.fill"
        static let shieldAlert = "exclamationmark.shield.fill"
    }

    /// Credential Icons
    struct Credential {
        static let credential = "doc.text.fill"
        static let badge = "badge.plus.radiowaves.right"
        static let certificate = "seal.fill"
        static let license = "doc.text.magnifyingglass"
        static let verified = "checkmark.seal.fill"
        static let expired = "xmark.seal.fill"
        static let expiring = "exclamationmark.triangle.fill"
        static let evidence = "clock.arrow.circlepath"
    }

    /// Wallet Icons
    struct Wallet {
        static let wallet = "wallet.pass.fill"
        static let add = "plus.circle.fill"
        static let scan = "qrcode.viewfinder"
        static let share = "square.and.arrow.up"
        static let settings = "gearshape.fill"
        static let profile = "person.circle.fill"
    }

    /// Verification Icons
    struct Verify {
        static let verify = "checkmark.shield.fill"
        static let verified = "checkmark.circle.fill"
        static let failed = "xmark.circle.fill"
        static let pending = "clock.fill"
        static let radar = "waveform.path"
        static let chain = "link"
        static let anchor = "anchor"
    }

    /// Timeline Icons
    struct Timeline {
        static let issue = "plus.circle.fill"
        static let verify = "checkmark.circle.fill"
        static let revoke = "xmark.circle.fill"
        static let anchor = "anchor.fill"
        static let conflict = "exclamationmark.triangle.fill"
        static let proof = "doc.text.magnifyingglass"
    }

    /// Navigation Icons
    struct Navigation {
        static let back = "chevron.left"
        static let forward = "chevron.right"
        static let up = "chevron.up"
        static let down = "chevron.down"
        static let close = "xmark"
        static let menu = "line.3.horizontal"
    }

    /// Status Icons
    struct Status {
        static let success = "checkmark.circle.fill"
        static let error = "xmark.circle.fill"
        static let warning = "exclamationmark.triangle.fill"
        static let info = "info.circle.fill"
        static let loading = "arrow.2.circlepath"
    }

    /// Network Icons
    struct Network {
        static let online = "wifi"
        static let offline = "wifi.slash"
        static let sync = "arrow.clockwise"
        static let cloud = "cloud.fill"
        static let cloudSlash = "cloud.slash.fill"
    }

    // MARK: - Custom VitalCV Glyphs (using SF Symbols as placeholders)
    /// These can be replaced with custom glyph assets
    struct VitalCV {
        static let identityOrb = "circle.fill" // Custom: identity orb
        static let trustAura = "sparkles" // Custom: trust aura
        static let proofChain = "link.circle.fill" // Custom: proof chain
        static let credentialGalaxy = "star.circle.fill" // Custom: credential galaxy
        static let trustRadar = "waveform.path.ecg" // Custom: trust radar
        static let didGuardian = "shield.lefthalf.filled" // Custom: DID guardian
    }
}

/// Icon view component with consistent styling
struct VitalCVIcon: View {
    let systemName: String
    var size: CGFloat = 20
    var color: Color = .walletText
    var weight: Font.Weight = .regular

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size, weight: weight))
            .foregroundColor(color)
    }
}

/// Icon button component
struct VitalCVIconButton: View {
    let systemName: String
    var size: CGFloat = 24
    var color: Color = .walletPrimary
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VitalCVIcon(systemName: systemName, size: size, color: color)
                .frame(width: size + 8, height: size + 8)
                .background(color.opacity(0.1))
                .cornerRadius(8)
        }
    }
}

/// Icon with badge
struct VitalCVIconBadge: View {
    let systemName: String
    var badgeCount: Int?
    var badgeColor: Color = .walletError
    var size: CGFloat = 20
    var color: Color = .walletText

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VitalCVIcon(systemName: systemName, size: size, color: color)

            if let count = badgeCount, count > 0 {
                Text("\(count)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white)
                    .padding(4)
                    .background(badgeColor)
                    .clipShape(Circle())
                    .offset(x: 8, y: -8)
            }
        }
    }
}

/// Icon grid for quick actions
struct VitalCVIconGrid: View {
    let icons: [(systemName: String, title: String, color: Color, action: () -> Void)]
    var columns: Int = 4
    var spacing: CGFloat = WalletSpacing.md

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: columns), spacing: spacing) {
            ForEach(Array(icons.enumerated()), id: \.offset) { _, icon in
                VStack(spacing: WalletSpacing.sm) {
                    VitalCVIconButton(
                        systemName: icon.systemName,
                        size: 32,
                        color: icon.color,
                        action: icon.action
                    )
                    Text(icon.title)
                        .font(WalletTypography.caption1)
                        .foregroundColor(.walletText)
                        .multilineTextAlignment(.center)
                }
            }
        }
    }
}

/// Animated icon (for loading states, etc.)
struct VitalCVAnimatedIcon: View {
    let systemName: String
    var size: CGFloat = 20
    var color: Color = .walletPrimary
    @State private var isAnimating = false

    var body: some View {
        VitalCVIcon(systemName: systemName, size: size, color: color)
            .rotationEffect(.degrees(isAnimating ? 360 : 0))
            .animation(
                Animation.linear(duration: 2)
                    .repeatForever(autoreverses: false),
                value: isAnimating
            )
            .onAppear {
                isAnimating = true
            }
    }
}

