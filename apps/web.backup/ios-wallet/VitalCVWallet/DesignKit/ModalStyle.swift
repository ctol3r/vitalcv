//
//  ModalStyle.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 5
//  Global modal style with dimmer blur
//

import SwiftUI

/// Global modal presentation style
struct VitalCVModalStyle: ViewModifier {
    var cornerRadius: CGFloat = WalletCornerRadius.xlarge
    var backgroundColor: Color = .walletCard
    var dimmerOpacity: Double = 0.4
    var blurStyle: UIBlurEffect.Style = .systemMaterial

    func body(content: Content) -> some View {
        content
            .background(backgroundColor)
            .cornerRadius(cornerRadius, corners: [.topLeft, .topRight])
            .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: -5)
    }
}

extension View {
    /// Apply VitalCV modal style
    func vitalCVModalStyle(
        cornerRadius: CGFloat = WalletCornerRadius.xlarge,
        backgroundColor: Color = .walletCard,
        dimmerOpacity: Double = 0.4
    ) -> some View {
        modifier(VitalCVModalStyle(
            cornerRadius: cornerRadius,
            backgroundColor: backgroundColor,
            dimmerOpacity: dimmerOpacity
        ))
    }
}

/// Modal dimmer background
struct ModalDimmer: View {
    var opacity: Double = 0.4
    var blurStyle: UIBlurEffect.Style = .systemMaterial
    var action: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(opacity)
                .ignoresSafeArea()

            BlurView(style: blurStyle)
                .ignoresSafeArea()
                .opacity(0.3)
        }
        .onTapGesture {
            action()
        }
    }
}

/// Full-screen modal container
struct VitalCVModal<Content: View>: View {
    @Binding var isPresented: Bool
    let content: Content
    var cornerRadius: CGFloat = WalletCornerRadius.xlarge
    var backgroundColor: Color = .walletCard
    var dimmerOpacity: Double = 0.4
    var dismissOnDimmerTap: Bool = true
    var dragToDismiss: Bool = true

    @State private var dragOffset: CGFloat = 0
    @State private var isDragging = false

    init(
        isPresented: Binding<Bool>,
        cornerRadius: CGFloat = WalletCornerRadius.xlarge,
        backgroundColor: Color = .walletCard,
        dimmerOpacity: Double = 0.4,
        dismissOnDimmerTap: Bool = true,
        dragToDismiss: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self._isPresented = isPresented
        self.cornerRadius = cornerRadius
        self.backgroundColor = backgroundColor
        self.dimmerOpacity = dimmerOpacity
        self.dismissOnDimmerTap = dismissOnDimmerTap
        self.dragToDismiss = dragToDismiss
        self.content = content()
    }

    var body: some View {
        ZStack {
            if isPresented {
                // Dimmer
                ModalDimmer(opacity: dimmerOpacity) {
                    if dismissOnDimmerTap {
                        dismiss()
                    }
                }
                .transition(.opacity)
                .zIndex(1)

                // Modal content
                VStack(spacing: 0) {
                    Spacer()

                    content
                        .vitalCVModalStyle(
                            cornerRadius: cornerRadius,
                            backgroundColor: backgroundColor,
                            dimmerOpacity: dimmerOpacity
                        )
                        .offset(y: dragOffset)
                        .gesture(
                            dragToDismiss ? DragGesture()
                                .onChanged { value in
                                    if value.translation.height > 0 {
                                        dragOffset = value.translation.height
                                        isDragging = true
                                    }
                                }
                                .onEnded { value in
                                    if value.translation.height > 150 {
                                        dismiss()
                                    } else {
                                        withAnimation(.spring()) {
                                            dragOffset = 0
                                            isDragging = false
                                        }
                                    }
                                }
                            : nil
                        )
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .zIndex(2)
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isPresented)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: dragOffset)
    }

    private func dismiss() {
        withAnimation {
            isPresented = false
            dragOffset = 0
        }
    }
}

/// Sheet-style modal modifier
extension View {
    func vitalCVSheet<Content: View>(
        isPresented: Binding<Bool>,
        cornerRadius: CGFloat = WalletCornerRadius.xlarge,
        backgroundColor: Color = .walletCard,
        dimmerOpacity: Double = 0.4,
        dismissOnDimmerTap: Bool = true,
        dragToDismiss: Bool = true,
        @ViewBuilder content: () -> Content
    ) -> some View {
        ZStack {
            self

            VitalCVModal(
                isPresented: isPresented,
                cornerRadius: cornerRadius,
                backgroundColor: backgroundColor,
                dimmerOpacity: dimmerOpacity,
                dismissOnDimmerTap: dismissOnDimmerTap,
                dragToDismiss: dragToDismiss,
                content: content
            )
        }
    }
}

/// Corner radius extension for specific corners
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

/// Modal header component
struct ModalHeader: View {
    let title: String
    var subtitle: String? = nil
    var onDismiss: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            HStack {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(title)
                        .font(VitalCVFonts.title2)
                        .foregroundColor(.walletText)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(VitalCVFonts.subheadline)
                            .foregroundColor(.walletTextSecondary)
                    }
                }

                Spacer()

                if let onDismiss = onDismiss {
                    Button(action: onDismiss) {
                        VitalCVIcon(
                            systemName: VitalCVIcons.Navigation.close,
                            size: 20,
                            color: .walletTextSecondary
                        )
                    }
                }
            }
            .padding(.horizontal, WalletSpacing.md)
            .padding(.top, WalletSpacing.md)

            Divider()
        }
    }
}

