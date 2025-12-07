//
//  AutoLockService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 37
//  Auto-lock after 30 seconds inactivity
//

import Foundation
import Combine
import UIKit

@MainActor
class AutoLockService: ObservableObject {
    static let shared = AutoLockService()

    @Published var isLocked: Bool = false

    private var lockTimer: Timer?
    private let lockDelay: TimeInterval = 30.0 // 30 seconds
    private var cancellables = Set<AnyCancellable>()

    private init() {
        setupObservers()
    }

    private func setupObservers() {
        // Observe app state changes
        NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)
            .sink { [weak self] _ in
                self?.lock()
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                self?.startLockTimer()
            }
            .store(in: &cancellables)

        // Start timer on initialization
        startLockTimer()
    }

    func startLockTimer() {
        cancelLockTimer()

        lockTimer = Timer.scheduledTimer(withTimeInterval: lockDelay, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.lock()
            }
        }
    }

    func cancelLockTimer() {
        lockTimer?.invalidate()
        lockTimer = nil
    }

    func unlock() {
        isLocked = false
        startLockTimer()
    }

    private func lock() {
        isLocked = true
        cancelLockTimer()

        // Optionally clear sensitive data from memory
        // In production, encrypt sensitive data when locking
    }

    func resetTimer() {
        if !isLocked {
            startLockTimer()
        }
    }
}








