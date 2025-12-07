//
//  AdaptiveSidebarView.swift
//  VitalCVWallet
//
//  Created: Batch 140-A - Task 8
//  Adaptive sidebar for iPadOS
//

import SwiftUI

/// AdaptiveSidebarView - Adaptive sidebar layout for iPadOS
/// Provides sidebar navigation on iPad, standard tabs on iPhone
struct AdaptiveSidebarView: View {
    @StateObject private var router = NavigationRouter.shared
    @EnvironmentObject var appState: AppStateContainer
    @State private var selectedTab: MainTab = .wallet

    var body: some View {
        if UIDevice.current.userInterfaceIdiom == .pad {
            // iPad: Sidebar layout
            NavigationSplitView {
                sidebarContent
            } detail: {
                detailContent
            }
        } else {
            // iPhone: Tab bar layout
            RootTabBarView()
        }
    }

    // MARK: - Sidebar Content (iPad)

    private var sidebarContent: some View {
        List(selection: $selectedTab) {
            ForEach(MainTab.allCases) { tab in
                NavigationLink(value: tab) {
                    Label(tab.rawValue, systemImage: tab.icon)
                }
                .tag(tab)
            }

            Divider()

            Section("Quick Actions") {
                Button(action: {
                    router.navigate(to: .scan)
                }) {
                    Label("Scan QR", systemImage: "qrcode.viewfinder")
                }

                Button(action: {
                    // Show credential offer
                }) {
                    Label("Add Credential", systemImage: "plus.circle.fill")
                }
            }

            Section("Recruiter") {
                NavigationLink(value: AppScreen.recruiter) {
                    Label("Recruiter Portal", systemImage: "person.2.fill")
                }
            }
        }
        .navigationTitle("VitalCV")
        .listStyle(.sidebar)
        .onChange(of: selectedTab) { oldValue, newValue in
            router.switchTab(newValue)
        }
    }

    // MARK: - Detail Content (iPad)

    private var detailContent: some View {
        NavigationStack(path: $router.navigationPath) {
            contentForTab(selectedTab)
                .navigationDestination(for: AppScreen.self) { screen in
                    destinationView(for: screen)
                }
        }
    }

    @ViewBuilder
    private func contentForTab(_ tab: MainTab) -> some View {
        switch tab {
        case .wallet:
            WalletHomeView()
        case .verify:
            VerifyHomeView()
        case .jobs:
            JobsFeedView()
        case .settings:
            SettingsView()
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

        case .recruiter:
            RecruiterHomeView()

        default:
            EmptyView()
        }
    }
}

// MARK: - Recruiter Home View (Placeholder)

struct RecruiterHomeView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Recruiter Portal")
                    .font(.largeTitle)
                    .bold()

                Text("Manage candidates and verifications")
                    .foregroundColor(.secondary)
            }
            .padding()
        }
        .navigationTitle("Recruiter")
    }
}

#Preview {
    AdaptiveSidebarView()
        .environmentObject(AppStateContainer.shared)
}

