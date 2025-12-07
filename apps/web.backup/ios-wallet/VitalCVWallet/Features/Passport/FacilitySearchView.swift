//
//  FacilitySearchView.swift
//  VitalCVWallet
//
//  Created: Multi-Facility Credential Passport - Phase 4 - Task 32
//  Add Facility search + quick connect
//

import SwiftUI
import Combine

/// FacilitySearchView - Search and connect to facilities
/// Phase 4 - Task 32
struct FacilitySearchView: View {
    @StateObject private var searchManager = FacilitySearchManager()
    @State private var searchText = ""
    @State private var showingOnboarding = false
    @State private var selectedFacility: FacilitySearchResult?

    var body: some View {
        NavigationView {
            VStack {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)

                    TextField("Search facilities...", text: $searchText)
                        .textFieldStyle(.plain)
                        .onSubmit {
                            performSearch()
                        }

                    if !searchText.isEmpty {
                        Button(action: {
                            searchText = ""
                            searchManager.clearResults()
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
                .padding(.horizontal)

                // Results
                if searchManager.isSearching {
                    ProgressView("Searching...")
                        .padding()
                } else if let results = searchManager.searchResults, !results.isEmpty {
                    List(results) { facility in
                        FacilitySearchResultRow(facility: facility) {
                            selectedFacility = facility
                            showingOnboarding = true
                        }
                    }
                } else if searchManager.hasSearched {
                    Text("No facilities found")
                        .foregroundColor(.secondary)
                        .padding()
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "building.2")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        Text("Search for facilities to connect")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                }
            }
            .navigationTitle("Add Facility")
            .sheet(isPresented: $showingOnboarding) {
                if let facility = selectedFacility {
                    FacilityOnboardingView(
                        facilityId: facility.facilityId,
                        facilityName: facility.name,
                        facilityLogo: nil
                    )
                }
            }
        }
    }

    private func performSearch() {
        guard !searchText.isEmpty else { return }
        searchManager.search(query: searchText)
    }
}

struct FacilitySearchResultRow: View {
    let facility: FacilitySearchResult
    let onConnect: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                Text(facility.name)
                    .font(.headline)

                if let location = facility.location {
                    Text(location)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                if let trustScore = facility.trustScore {
                    HStack {
                        Image(systemName: "shield.checkered")
                            .foregroundColor(trustScoreColor(trustScore))
                        Text("Trust: \(Int(trustScore * 100))%")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            Button(action: onConnect) {
                Text("Connect")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.blue)
                    .cornerRadius(8)
            }
        }
        .padding(.vertical, 8)
    }

    private func trustScoreColor(_ score: Double) -> Color {
        if score >= 0.8 {
            return .green
        } else if score >= 0.6 {
            return .yellow
        } else {
            return .red
        }
    }
}

class FacilitySearchManager: ObservableObject {
    @Published var searchResults: [FacilitySearchResult]?
    @Published var isSearching = false
    @Published var hasSearched = false

    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()

    func search(query: String) {
        guard !query.isEmpty else { return }

        isSearching = true
        hasSearched = true

        networkService.searchFacilities(query: query)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isSearching = false
                    if case .failure(let error) = completion {
                        print("Search error: \(error)")
                    }
                },
                receiveValue: { [weak self] response in
                    self?.searchResults = response.facilities
                    self?.isSearching = false
                }
            )
            .store(in: &cancellables)
    }

    func clearResults() {
        searchResults = nil
        hasSearched = false
    }
}

