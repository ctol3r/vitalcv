//
//  DragDownToDismissSheet.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 35
//  Drag-down-to-dismiss sheet animation
//

import SwiftUI

/// DragDownToDismissSheet - Sheet with drag-down-to-dismiss gesture
struct DragDownToDismissSheet<Content: View>: View {
    @Binding var isPresented: Bool
    let content: Content
    let onDismiss: (() -> Void)?

    @State private var dragOffset: CGFloat = 0
    @State private var dragVelocity: CGFloat = 0
    @State private var lastDragValue: DragGesture.Value?

    private let dismissThreshold: CGFloat = 100
    private let velocityThreshold: CGFloat = 500

    init(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self._isPresented = isPresented
        self.onDismiss = onDismiss
        self.content = content()
    }

    var body: some View {
        ZStack {
            // Background overlay
            if isPresented {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        dismiss()
                    }
                    .transition(.opacity)
            }

            // Sheet content
            if isPresented {
                VStack(spacing: 0) {
                    // Drag handle
                    RoundedRectangle(cornerRadius: 2.5)
                        .fill(Color.walletTextSecondary.opacity(0.3))
                        .frame(width: 40, height: 5)
                        .padding(.top, WalletSpacing.sm)
                        .padding(.bottom, WalletSpacing.xs)

                    content
                }
                .background(Color.walletBackground)
                .cornerRadius(WalletCornerRadius.large, corners: [.topLeft, .topRight])
                .offset(y: dragOffset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            // Only allow downward drag
                            if value.translation.height > 0 {
                                dragOffset = value.translation.height
                                dragVelocity = value.translation.height - (lastDragValue?.translation.height ?? 0)
                                lastDragValue = value
                            }
                        }
                        .onEnded { value in
                            let shouldDismiss = value.translation.height > dismissThreshold ||
                                               abs(dragVelocity) > velocityThreshold

                            if shouldDismiss {
                                dismiss()
                            } else {
                                // Spring back
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                    dragOffset = 0
                                }
                            }

                            lastDragValue = nil
                            dragVelocity = 0
                        }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
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

        // Haptic feedback
        HapticFeedbackService.shared.play(.impact(.light))

        onDismiss?()
    }
}

// MARK: - View Extension

extension View {
    /// Present a drag-down-to-dismiss sheet
    func dragDownSheet<Content: View>(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        ZStack {
            self

            DragDownToDismissSheet(
                isPresented: isPresented,
                onDismiss: onDismiss,
                content: content
            )
        }
    }
}

// MARK: - Corner Radius Extension (if not already exists)

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

#Preview {
    struct PreviewWrapper: View {
        @State private var showSheet = false

        var body: some View {
            VStack {
                Button("Show Sheet") {
                    showSheet = true
                }
            }
            .dragDownSheet(isPresented: $showSheet) {
                VStack(spacing: WalletSpacing.lg) {
                    Text("Drag Down to Dismiss")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletText)

                    Text("This sheet can be dismissed by dragging down")
                        .font(WalletTypography.body)
                        .foregroundColor(.walletTextSecondary)
                        .multilineTextAlignment(.center)

                    Spacer()
                }
                .padding(WalletSpacing.lg)
            }
        }
    }

    return PreviewWrapper()
}








