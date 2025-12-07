//
//  CredentialCardQuickActions.swift
//  VitalCVWallet
//
//  Created: Batch 566 - Task 9
//  Swipe-up "Quick Actions" for each card
//

import SwiftUI

/// CredentialCardQuickActions - Swipe-up quick actions sheet for credential cards
public struct CredentialCardQuickActions: ViewModifier {
    let credential: VerifiableCredential
    @Binding var isPresented: Bool
    let actions: [QuickAction]

    public func body(content: Content) -> some View {
        content
            .sheet(isPresented: $isPresented) {
                QuickActionsSheet(
                    credential: credential,
                    actions: actions,
                    isPresented: $isPresented
                )
            }
    }
}

extension View {
    public func credentialQuickActions(
        credential: VerifiableCredential,
        isPresented: Binding<Bool>,
        actions: [QuickAction]
    ) -> some View {
        modifier(CredentialCardQuickActions(
            credential: credential,
            isPresented: isPresented,
            actions: actions
        ))
    }
}

/// QuickActionsSheet - Bottom sheet with quick actions
public struct QuickActionsSheet: View {
    let credential: VerifiableCredential
    let actions: [QuickAction]
    @Binding var isPresented: Bool

    @State private var dragOffset: CGFloat = 0

    public var body: some View {
        VStack(spacing: 0) {
            // Drag handle
            RoundedRectangle(cornerRadius: 2.5)
                .fill(Color.walletTextSecondary.opacity(0.3))
                .frame(width: 40, height: 5)
                .padding(.top, WalletSpacing.sm)

            // Credential header
            HStack {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(credential.type.first ?? "Credential")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text(credential.issuer.name ?? credential.issuer.id)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()
            }
            .padding(.horizontal, WalletSpacing.lg)
            .padding(.top, WalletSpacing.md)

            // Quick actions
            VStack(spacing: WalletSpacing.md) {
                ForEach(actions) { action in
                    QuickActionButton(action: action) {
                        action.handler()
                        isPresented = false
                    }
                }
            }
            .padding(.horizontal, WalletSpacing.lg)
            .padding(.top, WalletSpacing.lg)
            .padding(.bottom, WalletSpacing.xl)
        }
        .background(Color.walletBackground)
        .cornerRadius(WalletCornerRadius.large, corners: [.topLeft, .topRight])
        .offset(y: dragOffset)
        .gesture(
            DragGesture()
                .onChanged { value in
                    if value.translation.height > 0 {
                        dragOffset = value.translation.height
                    }
                }
                .onEnded { value in
                    if value.translation.height > 100 {
                        isPresented = false
                    } else {
                        withAnimation(.spring()) {
                            dragOffset = 0
                        }
                    }
                }
        )
    }
}

/// QuickActionButton - Individual quick action button
public struct QuickActionButton: View {
    let action: QuickAction
    let onTap: () -> Void

    public var body: some View {
        Button(action: onTap) {
            HStack(spacing: WalletSpacing.md) {
                Image(systemName: action.icon)
                    .font(.system(size: 20))
                    .foregroundColor(action.color)
                    .frame(width: 40, height: 40)
                    .background(action.color.opacity(0.1))
                    .cornerRadius(WalletCornerRadius.medium)

                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(action.title)
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    if let subtitle = action.subtitle {
                        Text(subtitle)
                            .font(WalletTypography.caption1)
                            .foregroundColor(.walletTextSecondary)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundColor(.walletTextSecondary)
            }
            .padding(WalletSpacing.md)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.medium)
            .walletShadow(WalletShadow.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

/// QuickAction - Model for quick actions
public struct QuickAction: Identifiable {
    public let id = UUID()
    public let icon: String
    public let title: String
    public let subtitle: String?
    public let color: Color
    public let handler: () -> Void

    public init(
        icon: String,
        title: String,
        subtitle: String? = nil,
        color: Color = .walletPrimary,
        handler: @escaping () -> Void
    ) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.color = color
        self.handler = handler
    }
}

/// Default quick actions for credentials
extension QuickAction {
    public static func defaultActions(
        for credential: VerifiableCredential,
        onVerify: @escaping () -> Void,
        onShare: @escaping () -> Void,
        onViewDetails: @escaping () -> Void,
        onDelete: @escaping () -> Void
    ) -> [QuickAction] {
        [
            QuickAction(
                icon: "checkmark.shield.fill",
                title: "Verify",
                subtitle: "Check credential validity",
                color: .walletSuccess,
                handler: onVerify
            ),
            QuickAction(
                icon: "square.and.arrow.up",
                title: "Share",
                subtitle: "Share credential",
                color: .walletPrimary,
                handler: onShare
            ),
            QuickAction(
                icon: "info.circle.fill",
                title: "View Details",
                subtitle: "See full information",
                color: .walletInfo,
                handler: onViewDetails
            ),
            QuickAction(
                icon: "trash.fill",
                title: "Delete",
                subtitle: "Remove from wallet",
                color: .walletError,
                handler: onDelete
            )
        ]
    }
}

// MARK: - Corner Radius Extension

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

