//
//  SchedulerDashboardViewModel.swift
//  VitalCVWallet
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 1, Task 1
//  SchedulerDashboardViewModel: ObservableObject @MainActor
//

import Foundation
import Combine

@MainActor
class SchedulerDashboardViewModel: ObservableObject {
    // MARK: - Published State

    @Published var state: SchedulerDashboardState = .initial
    @Published var shifts: [Shift] = []
    @Published var roster: ProviderRoster = ProviderRoster(
        id: UUID().uuidString,
        providers: [],
        searchQuery: "",
        filters: RosterFilters()
    )
    @Published var todayCoverage: TodayCoverage?
    @Published var selectedShift: Shift?
    @Published var searchQuery: String = ""
    @Published var selectedShiftType: ShiftType?

    // MARK: - Private Properties

    private let networkService = NetworkService.shared
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        setupBindings()
    }

    // MARK: - Public Methods

    func loadDashboard() {
        state = .loading
        fetchShifts()
        fetchProviders()
    }

    func refresh() {
        loadDashboard()
    }

    func selectShift(_ shift: Shift) {
        selectedShift = shift
    }

    func updateSearchQuery(_ query: String) {
        searchQuery = query
        roster = ProviderRoster(
            id: roster.id,
            providers: roster.providers,
            searchQuery: query,
            filters: roster.filters
        )
    }

    func filterByShiftType(_ type: ShiftType?) {
        selectedShiftType = type
    }

    // MARK: - Private Methods

    private func setupBindings() {
        // Update today's coverage when shifts change
        $shifts
            .map { shifts in
                self.calculateTodayCoverage(shifts: shifts)
            }
            .assign(to: &$todayCoverage)
    }

    private func fetchShifts() {
        networkService.fetchShifts()
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.state = .error(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] shifts in
                    self?.shifts = shifts
                    self?.state = .loaded
                }
            )
            .store(in: &cancellables)
    }

    private func fetchProviders() {
        networkService.fetchProviders()
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        // Don't update state if shifts loaded successfully
                        if case .loaded = self?.state {
                            return
                        }
                        self?.state = .error(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] providers in
                    self?.roster = ProviderRoster(
                        id: UUID().uuidString,
                        providers: providers,
                        searchQuery: self?.searchQuery ?? "",
                        filters: self?.roster.filters ?? RosterFilters()
                    )
                    if case .loading = self?.state {
                        self?.state = .loaded
                    }
                }
            )
            .store(in: &cancellables)
    }

    private func calculateTodayCoverage(shifts: [Shift]) -> TodayCoverage {
        let today = Calendar.current.startOfDay(for: Date())
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: today)!

        let todayShifts = shifts.filter { shift in
            shift.startTime >= today && shift.startTime < tomorrow
        }

        // Calculate trust-weighted staff count
        let totalStaff = todayShifts.reduce(0) { sum, shift in
            let weightedCount = shift.assignedProviders.reduce(0.0) { count, assignment in
                count + assignment.trustScore
            }
            return sum + Int(weightedCount.rounded())
        }

        let requiredStaff = todayShifts.reduce(0) { sum, shift in
            sum + shift.minimumStaff
        }

        let coveragePercentage = requiredStaff > 0 ? Double(totalStaff) / Double(requiredStaff) : 1.0

        return TodayCoverage(
            totalShifts: todayShifts.count,
            totalStaff: totalStaff,
            requiredStaff: requiredStaff,
            coveragePercentage: coveragePercentage,
            shifts: todayShifts
        )
    }
}

// MARK: - State

enum SchedulerDashboardState: Equatable {
    case initial
    case loading
    case loaded
    case error(String)
}

// MARK: - Today Coverage

struct TodayCoverage: Identifiable {
    let id = UUID()
    let totalShifts: Int
    let totalStaff: Int
    let requiredStaff: Int
    let coveragePercentage: Double
    let shifts: [Shift]

    var isAdequate: Bool {
        coveragePercentage >= 1.0
    }

    var statusColor: String {
        if coveragePercentage >= 1.0 {
            return "green"
        } else if coveragePercentage >= 0.8 {
            return "yellow"
        } else {
            return "red"
        }
    }
}

