//
//  ChainHealthMonitor.swift
//  VitalCVWallet
//
//  Created: Batch 138-A - Task 5
//  Chain health monitoring with network recovery states
//

import Foundation
import SwiftUI
import Combine

/// ChainHealthMonitor - Monitors blockchain health and manages recovery states
@MainActor
public class ChainHealthMonitor: ObservableObject {
    public static let shared = ChainHealthMonitor()

    // MARK: - Published State

    /// Current health status
    @Published public var healthStatus: ChainHealthStatus = .unknown

    /// Network recovery state
    @Published public var recoveryState: NetworkRecoveryState = .healthy

    /// Current RPC endpoint
    @Published public var currentEndpoint: String?

    /// Available RPC endpoints
    @Published public var availableEndpoints: [RpcEndpoint] = []

    /// Connection latency
    @Published public var latency: TimeInterval?

    /// Last successful connection
    @Published public var lastSuccessfulConnection: Date?

    /// Consecutive failures
    @Published public var consecutiveFailures: Int = 0

    // MARK: - Configuration

    /// Maximum consecutive failures before switching endpoint
    public var maxFailures: Int = 3

    /// Health check interval
    public var healthCheckInterval: TimeInterval = 30.0

    /// Recovery retry interval
    public var recoveryRetryInterval: TimeInterval = 60.0

    // MARK: - Private State

    private var healthCheckTask: Task<Void, Never>?
    private var recoveryTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        setupDefaultEndpoints()
        startHealthMonitoring()
    }

    // MARK: - Public API

    /// Start health monitoring
    public func startHealthMonitoring() {
        guard healthCheckTask == nil else { return }

        healthCheckTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.performHealthCheck()
                try? await Task.sleep(nanoseconds: UInt64((self?.healthCheckInterval ?? 30.0) * 1_000_000_000))
            }
        }
    }

    /// Stop health monitoring
    public func stopHealthMonitoring() {
        healthCheckTask?.cancel()
        healthCheckTask = nil
        recoveryTask?.cancel()
        recoveryTask = nil
    }

    /// Perform health check
    public func performHealthCheck() async {
        guard let endpoint = currentEndpoint ?? availableEndpoints.first?.url else {
            healthStatus = .unavailable
            recoveryState = .noEndpoints
            return
        }

        let startTime = Date()

        do {
            // Attempt to connect and get block number
            let url = URL(string: "\(endpoint)/health")!
            var request = URLRequest(url: url)
            request.timeoutInterval = 5.0

            let (_, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                // Success
                let latency = Date().timeIntervalSince(startTime)
                self.latency = latency
                self.lastSuccessfulConnection = Date()
                self.consecutiveFailures = 0
                self.healthStatus = .healthy
                self.recoveryState = .healthy
                self.currentEndpoint = endpoint
            } else {
                // Failure
                await handleFailure()
            }
        } catch {
            // Failure
            await handleFailure()
        }
    }

    /// Switch to next available endpoint
    public func switchToNextEndpoint() async {
        guard let current = currentEndpoint,
              let currentIndex = availableEndpoints.firstIndex(where: { $0.url == current }) else {
            // Try first endpoint
            if let first = availableEndpoints.first {
                currentEndpoint = first.url
                await performHealthCheck()
            }
            return
        }

        // Try next endpoint
        let nextIndex = (currentIndex + 1) % availableEndpoints.count
        let nextEndpoint = availableEndpoints[nextIndex]
        currentEndpoint = nextEndpoint.url

        await performHealthCheck()
    }

    /// Start recovery process
    public func startRecovery() {
        guard recoveryTask == nil else { return }

        recoveryState = .recovering
        recoveryTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.performHealthCheck()

                if self?.healthStatus == .healthy {
                    self?.recoveryState = .healthy
                    self?.recoveryTask?.cancel()
                    self?.recoveryTask = nil
                    break
                }

                // Try next endpoint if still failing
                if self?.consecutiveFailures ?? 0 >= self?.maxFailures ?? 3 {
                    await self?.switchToNextEndpoint()
                }

                try? await Task.sleep(nanoseconds: UInt64((self?.recoveryRetryInterval ?? 60.0) * 1_000_000_000))
            }
        }
    }

    // MARK: - Private Methods

    private func handleFailure() async {
        consecutiveFailures += 1

        if consecutiveFailures >= maxFailures {
            healthStatus = .unhealthy
            recoveryState = .recovering

            // Start recovery
            startRecovery()

            // Switch endpoint
            await switchToNextEndpoint()
        } else {
            healthStatus = .degraded
        }
    }

    private func setupDefaultEndpoints() {
        // Default RPC endpoints (should be configured from environment)
        availableEndpoints = [
            RpcEndpoint(
                url: "https://rpc.vitalcv.io",
                name: "Primary",
                priority: 1
            ),
            RpcEndpoint(
                url: "https://rpc-backup.vitalcv.io",
                name: "Secondary",
                priority: 2
            )
        ]

        currentEndpoint = availableEndpoints.first?.url
    }
}

// MARK: - Supporting Types

public enum ChainHealthStatus {
    case unknown
    case healthy
    case degraded
    case unhealthy
    case unavailable
}

public enum NetworkRecoveryState {
    case healthy
    case recovering
    case noEndpoints
    case failed
}

public struct RpcEndpoint: Identifiable, Codable {
    public let id = UUID()
    public let url: String
    public let name: String
    public let priority: Int

    public init(url: String, name: String, priority: Int) {
        self.url = url
        self.name = name
        self.priority = priority
    }
}




