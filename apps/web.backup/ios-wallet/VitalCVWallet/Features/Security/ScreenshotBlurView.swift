//
//  ScreenshotBlurView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 33
//  Screenshot-blur for sensitive screens
//

import SwiftUI

struct ScreenshotBlurView: ViewModifier {
    @State private var isBlurred = false

    func body(content: Content) -> some View {
        content
            .blur(radius: isBlurred ? 20 : 0)
            .onAppear {
                setupScreenshotDetection()
            }
    }

    private func setupScreenshotDetection() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification,
            object: nil,
            queue: .main
        ) { _ in
            withAnimation(.easeInOut(duration: 0.2)) {
                isBlurred = true
            }

            // Reset after a delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isBlurred = false
                }
            }
        }
    }
}

extension View {
    func protectFromScreenshots() -> some View {
        modifier(ScreenshotBlurView())
    }
}

// MARK: - Secure Content View

struct SecureContentView<Content: View>: View {
    let content: Content
    @State private var showSecurityWarning = false

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            content
                .protectFromScreenshots()

            if showSecurityWarning {
                SecurityWarningOverlay()
            }
        }
        .onAppear {
            checkSecurityStatus()
        }
    }

    private func checkSecurityStatus() {
        let status = SecurityService.shared.checkAppIntegrity()
        if status == .compromised {
            showSecurityWarning = true
        }
    }
}

struct SecurityWarningOverlay: View {
    var body: some View {
        VStack {
            Spacer()

            VStack(spacing: WalletSpacing.md) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.walletWarning)

                Text("Security Warning")
                    .font(WalletTypography.title2)
                    .foregroundColor(.walletText)

                Text("Your device may be compromised. For your security, some features may be limited.")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, WalletSpacing.lg)
            }
            .padding(WalletSpacing.xl)
            .background(Color.walletCard)
            .cornerRadius(WalletCornerRadius.large)
            .walletShadow(WalletShadow.large)
            .padding(WalletSpacing.lg)

            Spacer()
        }
        .background(Color.black.opacity(0.5))
    }
}

