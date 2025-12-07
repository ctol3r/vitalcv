//
//  NotificationCenterView.swift
//  VitalCVWallet
//
//  Created: Notifications 2.0 - Phase 4
//  Notification center with sensory-rich, calm feed
//

import SwiftUI
import Combine

// MARK: - Notification Center View

struct NotificationCenterView: View {
    @StateObject private var viewModel = NotificationCenterViewModel()
    @EnvironmentObject var appState: AppStateContainer

    var body: some View {
        NavigationView {
            ZStack {
                if viewModel.notifications.isEmpty {
                    emptyStateView
                } else {
                    notificationList
                }
            }
            .navigationTitle("Notifications")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        viewModel.clearAll()
                    }) {
                        Text("Clear All")
                            .font(.subheadline)
                    }
                    .disabled(viewModel.notifications.isEmpty)
                }
            }
            .onAppear {
                viewModel.loadNotifications()
            }
        }
    }

    // MARK: - Notification List

    private var notificationList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.groupedNotifications.keys.sorted(by: >), id: \.self) { date in
                    if let notifications = viewModel.groupedNotifications[date] {
                        // Chain event grouping
                        if notifications.count > 1 && notifications.allSatisfy({ $0.type == .chainAnchor }) {
                            ChainEventGroupView(notifications: notifications)
                        } else {
                            ForEach(notifications) { notification in
                                NotificationCard(
                                    notification: notification,
                                    onDismiss: {
                                        viewModel.dismiss(notification)
                                    },
                                    onTap: {
                                        viewModel.handleTap(notification)
                                    }
                                )
                            }
                        }
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "bell.slash")
                .font(.system(size: 64))
                .foregroundColor(.gray.opacity(0.3))

            Text("All caught up")
                .font(.title2)
                .fontWeight(.semibold)

            Text("No new notifications")
                .font(.subheadline)
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Notification Card

struct NotificationCard: View {
    let notification: AppNotification
    let onDismiss: () -> Void
    let onTap: () -> Void

    @State private var isExpanded = false
    @State private var dragOffset: CGFloat = 0
    @State private var isHighlighted = false

    var body: some View {
        HStack(spacing: 12) {
            // Color indicator
            RoundedRectangle(cornerRadius: 4)
                .fill(notificationColor)
                .frame(width: 4)

            // Icon
            ZStack {
                Circle()
                    .fill(notificationColor.opacity(0.2))
                    .frame(width: 40, height: 40)

                Image(systemName: notificationIcon)
                    .foregroundColor(notificationColor)
                    .font(.system(size: 18))
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(notification.title)
                    .font(.headline)
                    .foregroundColor(.primary)

                if isExpanded {
                    Text(notification.message)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .transition(.opacity)
                }

                Text(notification.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundColor(.gray)
            }

            Spacer()

            // Visual indicator for revisit
            if notification.isRevisit {
                Circle()
                    .fill(Color.blue)
                    .frame(width: 8, height: 8)
                    .opacity(isHighlighted ? 1.0 : 0.5)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: notificationColor.opacity(0.1), radius: 4, x: 0, y: 2)
        )
        .overlay(
            // Glow effect when active
            RoundedRectangle(cornerRadius: 12)
                .stroke(notificationColor.opacity(isHighlighted ? 0.3 : 0), lineWidth: 2)
        )
        .offset(x: dragOffset)
        .gesture(
            DragGesture()
                .onChanged { value in
                    if value.translation.width < 0 {
                        dragOffset = value.translation.width
                    }
                }
                .onEnded { value in
                    if value.translation.width < -100 {
                        // Dismiss with spring animation
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                            dragOffset = -UIScreen.main.bounds.width
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            onDismiss()
                        }
                    } else {
                        withAnimation(.spring()) {
                            dragOffset = 0
                        }
                    }
                }
        )
        .onTapGesture {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isExpanded.toggle()
                if isExpanded {
                    isHighlighted = true
                    // Play haptic feedback
                    HapticFeedback.play(.selection)
                }
            }
        }
        .onAppear {
            // Subtle highlighting for revisit
            if notification.isRevisit {
                withAnimation(
                    Animation.easeInOut(duration: 2.0)
                        .repeatForever(autoreverses: true)
                ) {
                    isHighlighted = true
                }
            }
        }
    }

    // MARK: - Helpers

    private var notificationColor: Color {
        switch notification.type {
        case .trust, .proofSuccess:
            return .green
        case .complianceWarning:
            return .amber
        case .recruiterActivity:
            return .blue
        case .jobMatch:
            return .purple
        case .chainAnchor:
            return .blue
        }
    }

    private var notificationIcon: String {
        switch notification.type {
        case .trust, .proofSuccess:
            return "checkmark.circle.fill"
        case .complianceWarning:
            return "exclamationmark.triangle.fill"
        case .recruiterActivity:
            return "person.2.fill"
        case .jobMatch:
            return "star.fill"
        case .chainAnchor:
            return "link.circle.fill"
        }
    }
}

// MARK: - Chain Event Group View

struct ChainEventGroupView: View {
    let notifications: [AppNotification]
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "link.circle.fill")
                    .foregroundColor(.blue)

                Text("\(notifications.count) chain events")
                    .font(.headline)

                Spacer()

                Button(action: {
                    withAnimation {
                        isExpanded.toggle()
                    }
                }) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.blue)
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue.opacity(0.1))
            )

            if isExpanded {
                ForEach(notifications) { notification in
                    NotificationCard(
                        notification: notification,
                        onDismiss: {},
                        onTap: {}
                    )
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Notification Model

struct AppNotification: Identifiable, Codable {
    let id: UUID
    let type: NotificationType
    let title: String
    let message: String
    let timestamp: Date
    let credentialId: String?
    let profileId: String?
    var isRevisit: Bool = false

    enum NotificationType: String, Codable {
        case trust
        case proofSuccess
        case complianceWarning
        case recruiterActivity
        case jobMatch
        case chainAnchor
    }
}

// MARK: - Notification Center View Model

@MainActor
class NotificationCenterViewModel: ObservableObject {
    @Published var notifications: [AppNotification] = []

    var groupedNotifications: [Date: [AppNotification]] {
        Dictionary(grouping: notifications) { notification in
            Calendar.current.startOfDay(for: notification.timestamp)
        }
    }

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupSubscriptions()
    }

    func loadNotifications() {
        // Load from storage or API
        // For now, using mock data
        notifications = [
            AppNotification(
                id: UUID(),
                type: .trust,
                title: "Credential Verified",
                message: "Your DEA license has been successfully verified",
                timestamp: Date().addingTimeInterval(-3600),
                credentialId: "cred_123",
                profileId: nil
            ),
            AppNotification(
                id: UUID(),
                type: .chainAnchor,
                title: "Anchor Confirmed",
                message: "Credential anchored to blockchain",
                timestamp: Date().addingTimeInterval(-7200),
                credentialId: "cred_123",
                profileId: nil
            )
        ]
    }

    func dismiss(_ notification: AppNotification) {
        withAnimation {
            notifications.removeAll { $0.id == notification.id }
        }

        // Play dismiss haptic
        HapticFeedback.play(.selection)
    }

    func handleTap(_ notification: AppNotification) {
        // Navigate to credential or profile
        if let credentialId = notification.credentialId {
            // Navigate to credential detail
            print("Navigate to credential: \(credentialId)")
        } else if let profileId = notification.profileId {
            // Navigate to profile
            print("Navigate to profile: \(profileId)")
        }

        // Mark as visited
        if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
            notifications[index].isRevisit = false
        }
    }

    func clearAll() {
        withAnimation {
            notifications.removeAll()
        }
        HapticFeedback.play(.selection)
    }

    private func setupSubscriptions() {
        // Subscribe to TrustEventBus for real-time notifications
        TrustEventBus.shared.trustScoreChanged
            .sink { [weak self] change in
                self?.handleTrustEvent(change)
            }
            .store(in: &cancellables)

        TrustEventBus.shared.chainAnchorUpdated
            .sink { [weak self] update in
                self?.handleChainAnchorEvent(update)
            }
            .store(in: &cancellables)
    }

    private func handleTrustEvent(_ change: TrustScoreChange) {
        let notification = AppNotification(
            id: UUID(),
            type: .trust,
            title: "Trust Score Updated",
            message: "Credential trust score changed from \(Int(change.oldScore * 100))% to \(Int(change.newScore * 100))%",
            timestamp: Date(),
            credentialId: change.credentialId,
            profileId: nil
        )

        notifications.insert(notification, at: 0)

        // Trigger sensory feedback
        SensoryEventMapper.shared.triggerEvent(.credentialUpdated, credentialId: change.credentialId, view: nil)
    }

    private func handleChainAnchorEvent(_ update: ChainAnchorUpdate) {
        let notification = AppNotification(
            id: UUID(),
            type: .chainAnchor,
            title: "Chain Anchor Confirmed",
            message: "Credential successfully anchored to blockchain",
            timestamp: update.timestamp,
            credentialId: update.credentialId,
            profileId: nil
        )

        notifications.insert(notification, at: 0)

        // Trigger sensory feedback
        SensoryEventMapper.shared.triggerEvent(.chainAnchorConfirmed, credentialId: update.credentialId, view: nil)
    }
}

// MARK: - Color Extensions

extension Color {
    static let amber = Color(red: 1.0, green: 0.75, blue: 0.0)
}

