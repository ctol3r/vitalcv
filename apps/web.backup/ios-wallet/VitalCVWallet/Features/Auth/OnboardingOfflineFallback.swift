//
//  OnboardingOfflineFallback.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 13
//  Onboarding fallback for offline-first experience
//

import SwiftUI

/// OnboardingOfflineFallback - Handles offline-first onboarding flow
struct OnboardingOfflineFallback: ViewModifier {
    @ObservedObject var networkMonitor = NetworkReachabilityMonitor.shared
    @State private var showingOfflineBanner = false

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if !networkMonitor.isReachable && showingOfflineBanner {
                    OfflineBanner()
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .onChange(of: networkMonitor.isReachable) { isReachable in
                withAnimation {
                    showingOfflineBanner = !isReachable
                }
            }
            .onAppear {
                Task {
                    await networkMonitor.startMonitoring()
                }
            }
    }
}

// MARK: - Offline Banner

struct OfflineBanner: View {
    var body: some View {
        HStack(spacing: WalletSpacing.sm) {
            Image(systemName: "wifi.slash")
                .foregroundColor(.walletWarning)

            VStack(alignment: .leading, spacing: 2) {
                Text("Offline Mode")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletText)

                Text("You can continue setup offline")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletTextSecondary)
            }

            Spacer()
        }
        .padding(WalletSpacing.md)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.medium)
        .walletShadow(WalletShadow.medium)
        .padding(.horizontal, WalletSpacing.md)
        .padding(.top, WalletSpacing.sm)
    }
}

// MARK: - Offline-First Onboarding View

struct OfflineFirstOnboardingView: View {
    @ObservedObject var networkMonitor = NetworkReachabilityMonitor.shared
    @StateObject private var viewModel = OnboardingViewModel()
    @State private var canProceedOffline = true

    var body: some View {
        VStack(spacing: WalletSpacing.lg) {
            if !networkMonitor.isReachable {
                OfflineModeCard()
            }

            // Onboarding content continues normally
            // DID generation works offline
            // Network sync happens when connection is restored
        }
        .onAppear {
            Task {
                await networkMonitor.startMonitoring()
            }
        }
    }
}

// MARK: - Offline Mode Card

struct OfflineModeCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            HStack {
                Image(systemName: "wifi.slash")
                    .foregroundColor(.walletWarning)
                    .font(.title2)

                Text("Offline Mode Active")
                    .font(WalletTypography.headline)
                    .foregroundColor(.walletText)
            }

            Text("Your digital identity can be created and stored locally. You can sync with the network when you're back online.")
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)

            HStack(spacing: WalletSpacing.md) {
                Label("Local DID Generation", systemImage: "checkmark.circle.fill")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletSuccess)

                Label("Secure Storage", systemImage: "checkmark.circle.fill")
                    .font(WalletTypography.caption)
                    .foregroundColor(.walletSuccess)
            }
        }
        .padding(WalletSpacing.lg)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }
}

extension View {
    /// Apply offline-first onboarding fallback
    func offlineFirstOnboarding() -> some View {
        modifier(OnboardingOfflineFallback())
    }
}

#Preview {
    VStack {
        OfflineBanner()
        OfflineModeCard()
    }
    .padding()
}

