//
//  WalletHomeView.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 11
//  Updated: ARC A - Tasks 5-10
//  Wallet Home Screen with Apple Wallet-grade UI
//

import SwiftUI

struct WalletHomeView: View {
    @StateObject private var viewModel = WalletHomeViewModel()
    @EnvironmentObject var appState: AppStateContainer
    @State private var showingScan = false
    @State private var showingCredentialDetail = false
    @State private var selectedCredential: VerifiableCredential?

    // Task 5: ScrollView + LazyVStack
    var body: some View {
        NavigationView {
            ZStack {
                Color.walletBackground
                    .ignoresSafeArea()

                ScrollView {
                    LazyVStack(spacing: WalletSpacing.lg) {
                        // Task 34: Error banner for failed sync
                        if let error = viewModel.syncError {
                            ErrorBannerView(error: error) {
                                Task {
                                    await viewModel.refresh()
                                }
                            }
                            .padding(.top, WalletSpacing.md)
                        }

                        // Task 6: Large header "Your Credentials"
                        headerSection
                            .padding(.horizontal, WalletSpacing.md)
                            .padding(.top, WalletSpacing.lg)

                        // Task 7: Pinned segment filter
                        SegmentFilterView(selectedFilter: $viewModel.selectedFilter)
                            .padding(.horizontal, WalletSpacing.md)

                        // Search bar
                        UnifiedSearchBar(searchText: $viewModel.searchText) { query in
                            // Search handled by viewModel
                        }
                        .padding(.horizontal, WalletSpacing.md)

                        // Task 8: Adaptive grid layout for horizontal mode
                        if UIDevice.current.orientation.isLandscape || UIScreen.main.bounds.width > 600 {
                            gridLayoutView
                        } else {
                            listLayoutView
                        }
                    }
                    .padding(.bottom, WalletSpacing.xl)
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    // Empty - header is in content
                }
            }
            .sheet(isPresented: $showingScan) {
                ScanScreenView()
            }
            .sheet(item: $selectedCredential) { credential in
                CredentialDetailView(credential: credential)
            }
            .onAppear {
                viewModel.startPeriodicSync()
            }
            .onDisappear {
                viewModel.stopPeriodicSync()
            }
        }
    }

    // MARK: - Task 6: Large Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.sm) {
            Text("Your Credentials")
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .foregroundColor(.walletText)

            if !viewModel.credentialItems.isEmpty {
                Text("\(viewModel.credentialItems.count) credential\(viewModel.credentialItems.count == 1 ? "" : "s")")
                    .font(WalletTypography.subheadline)
                    .foregroundColor(.walletTextSecondary)
            }
        }
    }

    // MARK: - Task 8: Adaptive Grid Layout

    private var gridLayoutView: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: WalletSpacing.md),
                GridItem(.flexible(), spacing: WalletSpacing.md)
            ],
            spacing: WalletSpacing.md
        ) {
            ForEach(viewModel.filteredBySearch) { item in
                CredentialCardContainer(item: item) {
                    selectedCredential = item.credential
                }
            }
        }
        .padding(.horizontal, WalletSpacing.md)
    }

    // MARK: - List Layout (Vertical)

    private var listLayoutView: some View {
        VStack(spacing: WalletSpacing.md) {
            if viewModel.groupedCredentials.isEmpty {
                emptyStateView
                    .padding(.horizontal, WalletSpacing.md)
            } else {
                ForEach(viewModel.groupedCredentials, id: \.category) { group in
                    CredentialGroupSection(
                        category: group.category,
                        items: group.items,
                        onTap: { item in
                            selectedCredential = item.credential
                        },
                        onQuickVerify: { item in
                            // Task 19: Quick Verify
                            selectedCredential = item.credential
                            // TODO: Navigate directly to verification
                        },
                        onRenew: { item in
                            // Task 20: Renew action
                            // TODO: Implement renewal flow
                        },
                        onUpdate: { item in
                            // Task 20: Update action
                            // TODO: Implement update flow
                        }
                    )
                    .padding(.horizontal, WalletSpacing.md)
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: WalletSpacing.lg) {
            Image(systemName: "tray")
                .font(.system(size: 64))
                .foregroundColor(.walletTextSecondary.opacity(0.5))

            Text("No Credentials Yet")
                .font(WalletTypography.title2)
                .foregroundColor(.walletText)

            Text("Scan a QR code or receive a credential to get started")
                .font(WalletTypography.subheadline)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, WalletSpacing.lg)

            Button(action: { showingScan = true }) {
                HStack {
                    Image(systemName: "qrcode.viewfinder")
                    Text("Scan QR Code")
                }
                .font(WalletTypography.headline)
                .foregroundColor(.white)
                .padding(.horizontal, WalletSpacing.xl)
                .padding(.vertical, WalletSpacing.md)
                .background(Color.walletPrimary)
                .cornerRadius(WalletCornerRadius.large)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(WalletSpacing.xl)
    }

}

#Preview {
    WalletHomeView()
        .environmentObject(AppStateContainer.shared)
}

