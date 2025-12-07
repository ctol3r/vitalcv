//
//  OnboardingView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 36
//  Onboarding carousel (3 steps max)
//

import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var appState: AppStateContainer
    @StateObject private var viewModel = OnboardingViewModel()
    @State private var showingBiometricSetup = false

    let pages = [
        OnboardingPage(
            title: "Your Digital Identity",
            description: "Store and manage your verifiable credentials securely on your device.",
            icon: "person.badge.shield.checkmark.fill"
        ),
        OnboardingPage(
            title: "Instant Verification",
            description: "Share proof of your credentials with a simple QR code scan.",
            icon: "qrcode.viewfinder"
        ),
        OnboardingPage(
            title: "Privacy First",
            description: "You control what information to share. Selective disclosure built in.",
            icon: "lock.shield.fill"
        )
    ]

    var body: some View {
        ZStack {
            Color.walletBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Page content (Task 6: 3-screen onboarding)
                TabView(selection: $viewModel.currentPage) {
                    ForEach(0..<pages.count, id: \.self) { index in
                        OnboardingPageView(page: pages[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(.page)
                .indexViewStyle(.page(backgroundDisplayMode: .always))

                // Bottom actions
                VStack(spacing: WalletSpacing.md) {
                    if viewModel.currentPage == pages.count - 1 {
                        // Task 7: Skip account creation option
                        VStack(spacing: WalletSpacing.sm) {
                            Button(action: {
                                Task {
                                    await viewModel.createDID()
                                }
                            }) {
                                Text("Get Started")
                                    .font(WalletTypography.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.walletPrimary)
                                    .cornerRadius(WalletCornerRadius.medium)
                            }

                            Button(action: {
                                viewModel.skipAccountCreation()
                            }) {
                                Text("Continue without account")
                                    .font(WalletTypography.subheadline)
                                    .foregroundColor(.walletTextSecondary)
                            }
                        }
                        .padding(.horizontal, WalletSpacing.lg)
                    } else {
                        HStack(spacing: WalletSpacing.md) {
                            if viewModel.currentPage > 0 {
                                Button(action: {
                                    viewModel.previousPage()
                                }) {
                                    Text("Back")
                                        .font(WalletTypography.headline)
                                        .foregroundColor(.walletTextSecondary)
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(Color.walletCard)
                                        .cornerRadius(WalletCornerRadius.medium)
                                }
                            }

                            Button(action: {
                                withAnimation {
                                    viewModel.nextPage()
                                }
                            }) {
                                Text("Next")
                                    .font(WalletTypography.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.walletPrimary)
                                    .cornerRadius(WalletCornerRadius.medium)
                            }
                        }
                        .padding(.horizontal, WalletSpacing.lg)
                    }
                }
                .padding(.bottom, WalletSpacing.xl)
            }
        }
    }
}

struct OnboardingPage {
    let title: String
    let description: String
    let icon: String
}

struct OnboardingPageView: View {
    let page: OnboardingPage

    var body: some View {
        VStack(spacing: WalletSpacing.xl) {
            Spacer()

            Image(systemName: page.icon)
                .font(.system(size: 80))
                .foregroundColor(.walletPrimary)
                .padding(.bottom, WalletSpacing.lg)

            Text(page.title)
                .font(WalletTypography.largeTitle)
                .foregroundColor(.walletText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, WalletSpacing.lg)

            Text(page.description)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, WalletSpacing.xl)

            Spacer()
        }
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AppStateContainer.shared)
}

