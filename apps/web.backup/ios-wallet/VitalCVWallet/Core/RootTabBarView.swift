//
//  RootTabBarView.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 7
//  Root TabBar with Wallet, Verify, Jobs, Settings
//

import SwiftUI

/// RootTabBarView - Main tab bar container
/// Provides Wallet, Verify, Jobs, Settings tabs
struct RootTabBarView: View {
    @StateObject private var router = NavigationRouter.shared
    @EnvironmentObject var appState: AppStateContainer
    @State private var selectedTab: MainTab = .wallet

    var body: some View {
        TabView(selection: $selectedTab) {
            // Wallet Tab
            NavigationStack(path: $router.navigationPath) {
                WalletHomeView()
                    .navigationDestination(for: AppScreen.self) { screen in
                        destinationView(for: screen)
                    }
            }
            .tabItem {
                Label("Wallet", systemImage: "wallet.fill")
            }
            .tag(MainTab.wallet)

            // Verify Tab
            NavigationStack(path: $router.navigationPath) {
                VerifyHomeView()
                    .navigationDestination(for: AppScreen.self) { screen in
                        destinationView(for: screen)
                    }
            }
            .tabItem {
                Label("Verify", systemImage: "checkmark.shield.fill")
            }
            .tag(MainTab.verify)

            // Jobs Tab
            NavigationStack(path: $router.navigationPath) {
                JobsFeedView()
                    .navigationDestination(for: AppScreen.self) { screen in
                        destinationView(for: screen)
                    }
            }
            .tabItem {
                Label("Jobs", systemImage: "briefcase.fill")
            }
            .tag(MainTab.jobs)

            // Settings Tab
            NavigationStack(path: $router.navigationPath) {
                SettingsView()
                    .navigationDestination(for: AppScreen.self) { screen in
                        destinationView(for: screen)
                    }
            }
            .tabItem {
                Label("Settings", systemImage: "gearshape.fill")
            }
            .tag(MainTab.settings)
        }
        .onChange(of: selectedTab) { oldValue, newValue in
            router.switchTab(newValue)
        }
        .onAppear {
            selectedTab = router.selectedTab
        }
    }

    @ViewBuilder
    private func destinationView(for screen: AppScreen) -> some View {
        switch screen {
        case .walletDetail(let credentialId):
            if let credential = appState.credentials.first(where: { $0.id == credentialId }) {
                CredentialDetailView(credential: credential)
            } else {
                Text("Credential not found")
            }

        case .verifyResult(let credentialId):
            if let credential = appState.credentials.first(where: { $0.id == credentialId }) {
                VerificationResultView(result: nil, credential: credential)
            } else {
                Text("Credential not found")
            }

        case .jobDetail(let jobId):
            JobDetailView(jobId: jobId)

        case .jobApplication(let jobId):
            ApplyWithCredentialView(jobId: jobId)

        case .settingsDetail(let setting):
            SettingsDetailView(section: setting)

        case .recruiterCandidate(let candidateId):
            CandidateProfileView(candidateId: candidateId)

        case .scheduler(let shiftId):
            // Phase 5 - Task 38: Scheduler deep link
            SchedulerRootView()
                .onAppear {
                    // Navigate to specific shift if needed
                    // This would be handled by the view model
                }

        default:
            EmptyView()
        }
    }
}

// MARK: - Verify Home View (Placeholder)

struct VerifyHomeView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Verify Credentials")
                .font(.largeTitle)
                .bold()

            Text("Scan a QR code or select a credential to verify")
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding()

            Button(action: {
                // Open scan
                NavigationRouter.shared.navigate(to: .scan)
            }) {
                Label("Scan QR Code", systemImage: "qrcode.viewfinder")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.walletPrimary)
                    .cornerRadius(12)
            }
            .padding(.horizontal)
        }
        .navigationTitle("Verify")
    }
}

// MARK: - Job Detail View (Placeholder)

struct JobDetailView: View {
    let jobId: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Job Details")
                    .font(.largeTitle)
                    .bold()

                Text("Job ID: \(jobId)")
                    .foregroundColor(.secondary)
            }
            .padding()
        }
        .navigationTitle("Job")
    }
}

// MARK: - Settings Detail View (Placeholder)

struct SettingsDetailView: View {
    let section: SettingSection

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(section.title)
                    .font(.largeTitle)
                    .bold()

                Text("Settings section details")
                    .foregroundColor(.secondary)
            }
            .padding()
        }
        .navigationTitle(section.title)
    }
}

// MARK: - Candidate Profile View (Placeholder)

struct CandidateProfileView: View {
    let candidateId: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Candidate Profile")
                    .font(.largeTitle)
                    .bold()

                Text("Candidate ID: \(candidateId)")
                    .foregroundColor(.secondary)
            }
            .padding()
        }
        .navigationTitle("Candidate")
    }
}

#Preview {
    RootTabBarView()
        .environmentObject(AppStateContainer.shared)
}

