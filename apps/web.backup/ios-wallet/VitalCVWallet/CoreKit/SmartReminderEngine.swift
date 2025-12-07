//
//  SmartReminderEngine.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 4, Task 25
//  Smart reminder engine with 30/60/90 day countdowns, multi-expiration clustering, anchor-stale detection
//

import Foundation
import UserNotifications
import Combine

/// SmartReminderEngine - Predictive alerts that reduce burnout and protect clinicians
@MainActor
public class SmartReminderEngine: ObservableObject {
    public static let shared = SmartReminderEngine()

    @Published public private(set) var activeReminders: [SmartReminder] = []
    @Published public private(set) var suggestions: [InlineSuggestion] = []

    private let taskEngine = ComplianceTaskEngine.shared
    private let credentialStore = CredentialStore.shared
    private var cancellables = Set<AnyCancellable>()

    // Reminder thresholds (in days)
    private let reminderThresholds: [Int] = [90, 60, 30, 14, 7, 1]

    private init() {
        setupObservers()
    }

    // MARK: - Public API

    /// Generate smart reminders for all tasks
    public func generateReminders() async {
        var reminders: [SmartReminder] = []

        // Get all active tasks
        let tasks = taskEngine.activeTasks

        // Generate reminders for each task
        for task in tasks {
            if let dueDate = task.dueDate {
                let remindersForTask = generateRemindersForTask(task, dueDate: dueDate)
                reminders.append(contentsOf: remindersForTask)
            }
        }

        // Detect multi-expiration clusters
        let clusters = detectExpirationClusters(tasks: tasks)
        for cluster in clusters {
            reminders.append(createClusterReminder(cluster))
        }

        // Detect stale anchors
        let staleAnchorReminders = await detectStaleAnchors()
        reminders.append(contentsOf: staleAnchorReminders)

        // Detect evidence expired after issuer update
        let evidenceReminders = await detectExpiredEvidence()
        reminders.append(contentsOf: evidenceReminders)

        activeReminders = reminders.sorted { $0.triggerDate < $1.triggerDate }

        // Schedule notifications
        await scheduleNotifications(for: reminders)
    }

    /// Generate inline suggestions
    public func generateSuggestions() async {
        var suggestions: [InlineSuggestion] = []

        let tasks = taskEngine.activeTasks

        // Urgent task suggestions
        for task in tasks.filter({ $0.urgency == .high || $0.urgency == .critical }) {
            if task.isOverdue {
                suggestions.append(InlineSuggestion(
                    type: .urgent,
                    message: "Renew this now to avoid compliance drop",
                    taskId: task.id,
                    actionRoute: task.actionRoute
                ))
            } else if let daysUntil = task.daysUntilDue, daysUntil <= 7 {
                suggestions.append(InlineSuggestion(
                    type: .warning,
                    message: "Complete this task soon to maintain your trust score",
                    taskId: task.id,
                    actionRoute: task.actionRoute
                ))
            }
        }

        // Anchor refresh suggestions
        let staleTasks = tasks.filter { $0.type == .anchorStale }
        for task in staleTasks {
            suggestions.append(InlineSuggestion(
                type: .info,
                message: "Refresh anchor to restore trust",
                taskId: task.id,
                actionRoute: .refreshAnchor
            ))
        }

        // Trust score boost suggestions
        let highImpactTasks = tasks.filter { $0.trustImpactScore >= 0.10 }
        if highImpactTasks.count >= 3 {
            let totalBoost = highImpactTasks.reduce(0.0) { $0 + $1.trustImpactScore }
            suggestions.append(InlineSuggestion(
                type: .success,
                message: "Completing these \(highImpactTasks.count) tasks increases trustScore +\(Int(totalBoost * 100))%",
                taskId: nil,
                actionRoute: nil
            ))
        }

        self.suggestions = suggestions
    }

    // MARK: - Reminder Generation

    private func generateRemindersForTask(_ task: ComplianceTask, dueDate: Date) -> [SmartReminder] {
        var reminders: [SmartReminder] = []
        let calendar = Calendar.current

        for threshold in reminderThresholds {
            let reminderDate = calendar.date(byAdding: .day, value: -threshold, to: dueDate) ?? dueDate

            // Only create reminder if it's in the future
            if reminderDate > Date() {
                reminders.append(SmartReminder(
                    id: "\(task.id)-\(threshold)",
                    taskId: task.id,
                    type: .countdown,
                    triggerDate: reminderDate,
                    message: reminderMessage(for: task, daysUntil: threshold),
                    urgency: determineReminderUrgency(daysUntil: threshold),
                    metadata: ["threshold": "\(threshold)"]
                ))
            }
        }

        return reminders
    }

    private func reminderMessage(for task: ComplianceTask, daysUntil: Int) -> String {
        switch daysUntil {
        case 90:
            return "\(task.title) expires in 90 days. Start planning renewal."
        case 60:
            return "\(task.title) expires in 60 days. Begin renewal process."
        case 30:
            return "\(task.title) expires in 30 days. Renewal needed soon."
        case 14:
            return "\(task.title) expires in 14 days. Action required."
        case 7:
            return "\(task.title) expires in 7 days. Urgent renewal needed."
        case 1:
            return "\(task.title) expires tomorrow. Immediate action required."
        default:
            return "\(task.title) requires attention."
        }
    }

    private func determineReminderUrgency(daysUntil: Int) -> Urgency {
        switch daysUntil {
        case 90, 60:
            return .low
        case 30:
            return .medium
        case 14, 7:
            return .high
        case 1:
            return .critical
        default:
            return .medium
        }
    }

    // MARK: - Multi-Expiration Clustering

    private func detectExpirationClusters(tasks: [ComplianceTask]) -> [ExpirationCluster] {
        var clusters: [ExpirationCluster] = []

        // Group tasks by expiration date (within 7 days of each other)
        let calendar = Calendar.current
        var groupedTasks: [Date: [ComplianceTask]] = [:]

        for task in tasks {
            guard let dueDate = task.dueDate else { continue }

            // Round to start of day for grouping
            let dayStart = calendar.startOfDay(for: dueDate)

            if groupedTasks[dayStart] == nil {
                groupedTasks[dayStart] = []
            }
            groupedTasks[dayStart]?.append(task)
        }

        // Find clusters (3+ tasks expiring within 7 days)
        for (date, tasks) in groupedTasks {
            if tasks.count >= 3 {
                // Check if there are nearby dates (within 7 days)
                var clusterTasks = tasks
                for (otherDate, otherTasks) in groupedTasks {
                    if otherDate != date {
                        let daysBetween = abs(calendar.dateComponents([.day], from: date, to: otherDate).day ?? 0)
                        if daysBetween <= 7 {
                            clusterTasks.append(contentsOf: otherTasks)
                        }
                    }
                }

                if clusterTasks.count >= 3 {
                    clusters.append(ExpirationCluster(
                        id: UUID().uuidString,
                        tasks: clusterTasks,
                        earliestExpiration: clusterTasks.compactMap { $0.dueDate }.min() ?? date,
                        count: clusterTasks.count
                    ))
                }
            }
        }

        return clusters
    }

    private func createClusterReminder(_ cluster: ExpirationCluster) -> SmartReminder {
        let daysUntil = Calendar.current.dateComponents([.day], from: Date(), to: cluster.earliestExpiration).day ?? 0

        return SmartReminder(
            id: "cluster-\(cluster.id)",
            taskId: nil,
            type: .cluster,
            triggerDate: Date(), // Trigger immediately
            message: "\(cluster.count) credentials expiring soon. Batch renewal recommended.",
            urgency: daysUntil <= 7 ? .high : .medium,
            metadata: ["clusterId": cluster.id, "taskCount": "\(cluster.count)"]
        )
    }

    // MARK: - Stale Anchor Detection

    private func detectStaleAnchors() async -> [SmartReminder] {
        var reminders: [SmartReminder] = []

        await credentialStore.loadCredentials()
        let credentials = credentialStore.getAllCredentials()

        for credential in credentials {
            if let anchorId = credential.chainAnchorId {
                // TODO: Check anchor age from ChainSnapshotStore
                // For now, create reminder if anchor exists but task exists
                let staleTasks = taskEngine.tasks(type: .anchorStale)
                if staleTasks.contains(where: { $0.credentialId == credential.id }) {
                    reminders.append(SmartReminder(
                        id: "stale-\(credential.id)",
                        taskId: staleTasks.first(where: { $0.credentialId == credential.id })?.id,
                        type: .anchorStale,
                        triggerDate: Date(),
                        message: "Chain anchor for \(credential.credentialSubject.type ?? "credential") is stale. Refresh to restore trust.",
                        urgency: .medium,
                        metadata: ["credentialId": credential.id, "anchorId": anchorId]
                    ))
                }
            }
        }

        return reminders
    }

    // MARK: - Expired Evidence Detection

    private func detectExpiredEvidence() async -> [SmartReminder] {
        var reminders: [SmartReminder] = []

        await credentialStore.loadCredentials()
        let credentials = credentialStore.getAllCredentials()

        for credential in credentials {
            if let evidence = credential.evidence {
                for evidenceItem in evidence {
                    // Check if evidence timestamp is older than credential update
                    if evidenceItem.timestamp < credential.issuanceDate {
                        reminders.append(SmartReminder(
                            id: "evidence-\(credential.id)-\(evidenceItem.id)",
                            taskId: nil,
                            type: .evidenceExpired,
                            triggerDate: Date(),
                            message: "Evidence for \(credential.credentialSubject.type ?? "credential") may be outdated. Update evidence to maintain trust.",
                            urgency: .low,
                            metadata: ["credentialId": credential.id, "evidenceId": evidenceItem.id]
                        ))
                    }
                }
            }
        }

        return reminders
    }

    // MARK: - Notification Scheduling

    private func scheduleNotifications(for reminders: [SmartReminder]) async {
        let center = UNUserNotificationCenter.current()

        // Request permission
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            guard granted else { return }
        } catch {
            print("Failed to request notification permission: \(error)")
            return
        }

        // Remove existing notifications
        center.removeAllPendingNotificationRequests()

        // Schedule new notifications
        for reminder in reminders {
            let content = UNMutableNotificationContent()
            content.title = "Compliance Reminder"
            content.body = reminder.message
            content.sound = .default
            content.badge = NSNumber(value: taskEngine.urgentTasks.count)

            // Set category for actions
            content.categoryIdentifier = "COMPLIANCE_TASK"

            // Schedule trigger
            let trigger = UNCalendarNotificationTrigger(
                dateMatching: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: reminder.triggerDate),
                repeats: false
            )

            let request = UNNotificationRequest(
                identifier: reminder.id,
                content: content,
                trigger: trigger
            )

            do {
                try await center.add(request)
            } catch {
                print("Failed to schedule notification: \(error)")
            }
        }

        // Update app badge
        await updateAppBadge()
    }

    private func updateAppBadge() async {
        let urgentCount = taskEngine.urgentTasks.count
        await MainActor.run {
            UIApplication.shared.applicationIconBadgeNumber = urgentCount
        }
    }

    // MARK: - Observers

    private func setupObservers() {
        // Observe task changes
        taskEngine.$tasks
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.generateReminders()
                    await self?.generateSuggestions()
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Models

public struct SmartReminder: Identifiable, Codable {
    public let id: String
    public let taskId: String?
    public let type: ReminderType
    public let triggerDate: Date
    public let message: String
    public let urgency: Urgency
    public let metadata: [String: String]

    public init(
        id: String,
        taskId: String?,
        type: ReminderType,
        triggerDate: Date,
        message: String,
        urgency: Urgency,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.taskId = taskId
        self.type = type
        self.triggerDate = triggerDate
        self.message = message
        self.urgency = urgency
        self.metadata = metadata
    }
}

public enum ReminderType: String, Codable {
    case countdown = "countdown"
    case cluster = "cluster"
    case anchorStale = "anchorStale"
    case evidenceExpired = "evidenceExpired"
}

public struct ExpirationCluster: Identifiable {
    public let id: String
    public let tasks: [ComplianceTask]
    public let earliestExpiration: Date
    public let count: Int
}

public struct InlineSuggestion: Identifiable {
    public let id = UUID().uuidString
    public let type: SuggestionType
    public let message: String
    public let taskId: String?
    public let actionRoute: ActionRoute?

    public init(
        type: SuggestionType,
        message: String,
        taskId: String?,
        actionRoute: ActionRoute?
    ) {
        self.type = type
        self.message = message
        self.taskId = taskId
        self.actionRoute = actionRoute
    }
}

public enum SuggestionType: String {
    case urgent = "urgent"
    case warning = "warning"
    case info = "info"
    case success = "success"
}

