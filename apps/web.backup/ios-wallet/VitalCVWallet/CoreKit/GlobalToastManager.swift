//
//  GlobalToastManager.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 5
//  Global toast notification manager with queueing system
//

import Foundation
import SwiftUI
import Combine

/// GlobalToastManager - Manages toast notifications with queueing
@MainActor
public class GlobalToastManager: ObservableObject {
    public static let shared = GlobalToastManager()

    // MARK: - Published State

    /// Current active toast
    @Published public var currentToast: ToastMessage?

    /// Queue of pending toasts
    @Published public private(set) var toastQueue: [ToastMessage] = []

    /// Maximum number of toasts to show simultaneously
    public var maxConcurrentToasts: Int = 1

    /// Default toast duration
    public var defaultDuration: TimeInterval = 3.0

    // MARK: - Private State

    private var toastTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    private init() {
        startToastProcessor()
    }

    // MARK: - Public API

    /// Show a toast message
    public func show(
        _ message: String,
        type: ToastType = .info,
        duration: TimeInterval? = nil,
        action: ToastAction? = nil
    ) {
        let toast = ToastMessage(
            id: UUID().uuidString,
            message: message,
            type: type,
            duration: duration ?? defaultDuration,
            action: action
        )

        enqueue(toast)
    }

    /// Show success toast
    public func showSuccess(_ message: String, duration: TimeInterval? = nil) {
        show(message, type: .success, duration: duration)
    }

    /// Show error toast
    public func showError(_ message: String, duration: TimeInterval? = nil) {
        show(message, type: .error, duration: duration)
    }

    /// Show warning toast
    public func showWarning(_ message: String, duration: TimeInterval? = nil) {
        show(message, type: .warning, duration: duration)
    }

    /// Show info toast
    public func showInfo(_ message: String, duration: TimeInterval? = nil) {
        show(message, type: .info, duration: duration)
    }

    /// Dismiss current toast
    public func dismiss() {
        currentToast = nil
    }

    /// Clear all toasts
    public func clearAll() {
        currentToast = nil
        toastQueue.removeAll()
    }

    /// Dismiss toast by ID
    public func dismiss(id: String) {
        if currentToast?.id == id {
            currentToast = nil
        }
        toastQueue.removeAll { $0.id == id }
    }

    // MARK: - Private Methods

    private func enqueue(_ toast: ToastMessage) {
        toastQueue.append(toast)
    }

    private func startToastProcessor() {
        toastTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.processNextToast()
                try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
            }
        }
    }

    private func processNextToast() async {
        // If no current toast and queue has items, show next
        if currentToast == nil, !toastQueue.isEmpty {
            let nextToast = toastQueue.removeFirst()
            currentToast = nextToast

            // Auto-dismiss after duration
            Task {
                try? await Task.sleep(nanoseconds: UInt64(nextToast.duration * 1_000_000_000))
                await MainActor.run {
                    if self.currentToast?.id == nextToast.id {
                        self.currentToast = nil
                    }
                }
            }
        }
    }
}

// MARK: - Toast Types

public struct ToastMessage: Identifiable {
    public let id: String
    public let message: String
    public let type: ToastType
    public let duration: TimeInterval
    public let action: ToastAction?
    public let timestamp: Date

    public init(
        id: String = UUID().uuidString,
        message: String,
        type: ToastType,
        duration: TimeInterval,
        action: ToastAction? = nil,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.message = message
        self.type = type
        self.duration = duration
        self.action = action
        self.timestamp = timestamp
    }
}

public enum ToastType {
    case success
    case error
    case warning
    case info

    public var color: Color {
        switch self {
        case .success:
            return .walletSuccess
        case .error:
            return .walletError
        case .warning:
            return .walletWarning
        case .info:
            return .walletInfo
        }
    }

    public var icon: String {
        switch self {
        case .success:
            return "checkmark.circle.fill"
        case .error:
            return "xmark.circle.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .info:
            return "info.circle.fill"
        }
    }
}

public struct ToastAction {
    public let label: String
    public let action: () -> Void

    public init(label: String, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }
}

// MARK: - Toast View Modifier

struct ToastModifier: ViewModifier {
    @ObservedObject var toastManager = GlobalToastManager.shared

    func body(content: Content) -> some View {
        ZStack {
            content

            if let toast = toastManager.currentToast {
                VStack {
                    Spacer()
                    ToastView(toast: toast)
                        .padding()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: toastManager.currentToast?.id)
            }
        }
    }
}

extension View {
    public func withToast() -> some View {
        modifier(ToastModifier())
    }
}

// MARK: - Toast View

struct ToastView: View {
    let toast: ToastMessage
    @ObservedObject var toastManager = GlobalToastManager.shared

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: toast.type.icon)
                .foregroundColor(toast.type.color)

            Text(toast.message)
                .font(.body)
                .foregroundColor(.primary)

            Spacer()

            if let action = toast.action {
                Button(action.label) {
                    action.action()
                    toastManager.dismiss()
                }
                .font(.subheadline)
                .foregroundColor(toast.type.color)
            }

            Button {
                toastManager.dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
        .onTapGesture {
            toastManager.dismiss()
        }
    }
}








