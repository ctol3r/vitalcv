//
//  NetworkReachabilityMonitor.swift
//  VitalCVWallet
//
//  Created: Batch 551 - Task 5
//  Network reachability monitoring
//

import Foundation
import Network
import Combine

/// Network reachability monitor using NWPathMonitor
@MainActor
public class NetworkReachabilityMonitor: ObservableObject {
    public static let shared = NetworkReachabilityMonitor()

    @Published public var isReachable: Bool = true
    @Published public var connectionType: ConnectionType = .unknown
    @Published public var isExpensive: Bool = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.vitalcv.network.monitor")
    private var cancellables = Set<AnyCancellable>()

    public enum ConnectionType {
        case wifi
        case cellular
        case ethernet
        case other
        case unknown
    }

    private init() {}

    // MARK: - Monitoring

    /// Start monitoring network reachability
    public func startMonitoring() async {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.updateStatus(path: path)
            }
        }
        monitor.start(queue: queue)

        // Initial status
        await updateStatus(path: monitor.currentPath)
    }

    /// Stop monitoring network reachability
    public func stopMonitoring() {
        monitor.cancel()
    }

    private func updateStatus(path: NWPath) {
        isReachable = path.status == .satisfied
        isExpensive = path.isExpensive

        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else if path.usesInterfaceType(.other) {
            connectionType = .other
        } else {
            connectionType = .unknown
        }

        // Post notification
        NotificationCenter.default.post(
            name: .networkStatusChanged,
            object: nil,
            userInfo: [
                "isReachable": isReachable,
                "connectionType": connectionType,
                "isExpensive": isExpensive
            ]
        )

        Logger.shared.log(
            "Network status: \(isReachable ? "Connected" : "Disconnected") via \(connectionType)",
            level: .info
        )
    }

    // MARK: - Convenience

    /// Check if network is currently reachable
    public var isCurrentlyReachable: Bool {
        return monitor.currentPath.status == .satisfied
    }

    /// Check if connection is expensive (cellular data)
    public var isCurrentlyExpensive: Bool {
        return monitor.currentPath.isExpensive
    }
}

// MARK: - Notification Extensions

extension Notification.Name {
    static let networkStatusChanged = Notification.Name("networkStatusChanged")
}

