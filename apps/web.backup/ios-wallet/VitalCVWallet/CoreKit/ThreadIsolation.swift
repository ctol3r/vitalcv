//
//  ThreadIsolation.swift
//  VitalCVWallet
//
//  Created: Batch 551 - Task 3
//  Thread isolations for main/UI/IO threads
//

import Foundation
import SwiftUI

/// Thread isolation utilities for safe concurrency
/// Ensures UI updates happen on MainActor, I/O on background threads
public enum ThreadIsolation {

    // MARK: - Main Thread (UI)

    /// Execute UI updates on main thread
    @MainActor
    public static func onMain<T>(_ operation: @MainActor () throws -> T) rethrows -> T {
        return try operation()
    }

    /// Execute UI updates on main thread (async)
    @MainActor
    public static func onMainAsync<T>(_ operation: @MainActor () async throws -> T) async rethrows -> T {
        return try await operation()
    }

    // MARK: - Background Thread (I/O)

    /// Execute I/O operations on background thread
    public static func onIO<T>(_ operation: () async throws -> T) async rethrows -> T {
        return try await withTaskGroup(of: T.self) { group in
            group.addTask {
                return try await operation()
            }
            return try await group.next()!
        }
    }

    /// Execute I/O operations on background thread with priority
    public static func onIO<T>(
        priority: TaskPriority = .userInitiated,
        _ operation: @escaping () async throws -> T
    ) async rethrows -> T {
        return try await Task(priority: priority) {
            try await operation()
        }.value
    }

    // MARK: - UI Updates from Background

    /// Safely update UI from background thread
    public static func updateUI<T>(_ operation: @MainActor () throws -> T) async rethrows -> T {
        return try await MainActor.run {
            try operation()
        }
    }

    /// Safely update UI from background thread (non-throwing)
    public static func updateUI(_ operation: @MainActor () -> Void) async {
        await MainActor.run {
            operation()
        }
    }

    // MARK: - Background Work from UI

    /// Execute background work from UI thread
    public static func doBackground<T>(
        priority: TaskPriority = .userInitiated,
        _ operation: @escaping () async throws -> T
    ) async rethrows -> T {
        return try await Task(priority: priority) {
            try await operation()
        }.value
    }

    // MARK: - Actor Isolation Helpers

    /// Ensure operation runs on specific actor
    public static func onActor<A: Actor, T>(
        _ actor: A,
        _ operation: @Sendable (isolated A) async throws -> T
    ) async rethrows -> T {
        return try await actor.operation(operation)
    }
}

// MARK: - View Extensions

extension View {
    /// Execute async operation and update view state on main thread
    public func withMainActor<T>(
        _ operation: @escaping () async throws -> T,
        onSuccess: @MainActor @escaping (T) -> Void,
        onError: @MainActor @escaping (Error) -> Void = { ErrorHandler.shared.handle($0) }
    ) -> some View {
        self.task {
            do {
                let result = try await operation()
                await MainActor.run {
                    onSuccess(result)
                }
            } catch {
                await MainActor.run {
                    onError(error)
                }
            }
        }
    }
}

// MARK: - Task Extensions

extension Task where Failure == Never {
    /// Create a task that updates UI on main thread
    @MainActor
    public static func uiTask<T>(
        priority: TaskPriority = .userInitiated,
        operation: @escaping @MainActor () async -> T
    ) -> Task<T, Never> {
        return Task(priority: priority) { @MainActor in
            await operation()
        }
    }
}

extension Task where Failure == Error {
    /// Create a task that updates UI on main thread (throwing)
    @MainActor
    public static func uiTask<T>(
        priority: TaskPriority = .userInitiated,
        operation: @escaping @MainActor () async throws -> T
    ) -> Task<T, Error> {
        return Task(priority: priority) { @MainActor in
            try await operation()
        }
    }
}

