//
//  ComplianceTaskEngine.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 1, Task 1
//  Central logic engine for compliance task detection and management
//

import Foundation
import Combine
import UIKit

/// ComplianceTaskEngine - Central engine for compliance task detection and management
@MainActor
public class ComplianceTaskEngine: ObservableObject {
    public static let shared = ComplianceTaskEngine()

    @Published public private(set) var tasks: [ComplianceTask] = []
    @Published public private(set) var hazards: [IdentityHealthHazard] = []
    @Published public private(set) var isDetecting: Bool = false
    @Published public private(set) var lastDetectionDate: Date?

    private let rulesLibrary = ComplianceRulesLibrary.shared
    private let credentialStore = CredentialStore.shared
    private let trustScoreCalculator = TrustScoreCalculator.shared
    private var detectionTimer: Timer?
    private var cancellables = Set<AnyCancellable>()

    // Background refresh interval (in seconds)
    private let backgroundRefreshInterval: TimeInterval = 3600 // 1 hour

    private init() {
        setupObservers()
    }

    // MARK: - Public API

    /// Run task detection pipeline (called at launch and on demand)
    public func detectTasks() async {
        guard !isDetecting else { return }

        isDetecting = true
        defer { isDetecting = false }

        var detectedTasks: [ComplianceTask] = []

        // Load credentials
        await credentialStore.loadCredentials()
        let credentials = credentialStore.getAllCredentials()

        // Detect tasks for each credential
        for credential in credentials {
            let credentialTasks = await detectTasksForCredential(credential)
            detectedTasks.append(contentsOf: credentialTasks)
        }

        // Detect global tasks (not tied to specific credentials)
        let globalTasks = await detectGlobalTasks()
        detectedTasks.append(contentsOf: globalTasks)

        // Update tasks list
        tasks = mergeTasks(existing: tasks, new: detectedTasks)

        // Detect identity health hazards
        hazards = detectHazards(from: tasks)

        // Update last detection date
        lastDetectionDate = Date()
    }

    /// Mark task as completed
    public func markTaskComplete(_ taskId: String) async {
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else { return }

        var updatedTask = tasks[index]
        updatedTask = ComplianceTask(
            id: updatedTask.id,
            type: updatedTask.type,
            urgency: updatedTask.urgency,
            dueDate: updatedTask.dueDate,
            trustImpactScore: updatedTask.trustImpactScore,
            actionRoute: updatedTask.actionRoute,
            title: updatedTask.title,
            description: updatedTask.description,
            category: updatedTask.category,
            credentialId: updatedTask.credentialId,
            createdAt: updatedTask.createdAt,
            updatedAt: Date(),
            isCompleted: true,
            completedAt: Date(),
            snoozedUntil: nil,
            matchScoreImpact: updatedTask.matchScoreImpact,
            recruiterVisible: updatedTask.recruiterVisible,
            metadata: updatedTask.metadata
        )

        tasks[index] = updatedTask

        // Recalculate trust score after task completion
        await recalculateTrustScore()

        // Re-detect tasks (completion may create new tasks)
        await detectTasks()
    }

    /// Snooze task until date
    public func snoozeTask(_ taskId: String, until date: Date) {
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else { return }

        var updatedTask = tasks[index]
        updatedTask = ComplianceTask(
            id: updatedTask.id,
            type: updatedTask.type,
            urgency: updatedTask.urgency,
            dueDate: updatedTask.dueDate,
            trustImpactScore: updatedTask.trustImpactScore,
            actionRoute: updatedTask.actionRoute,
            title: updatedTask.title,
            description: updatedTask.description,
            category: updatedTask.category,
            credentialId: updatedTask.credentialId,
            createdAt: updatedTask.createdAt,
            updatedAt: Date(),
            isCompleted: updatedTask.isCompleted,
            completedAt: updatedTask.completedAt,
            snoozedUntil: date,
            matchScoreImpact: updatedTask.matchScoreImpact,
            recruiterVisible: updatedTask.recruiterVisible,
            metadata: updatedTask.metadata
        )

        tasks[index] = updatedTask
    }

    /// Get active (non-completed, non-snoozed) tasks
    public var activeTasks: [ComplianceTask] {
        return tasks.filter { task in
            !task.isCompleted && !task.isSnoozed
        }
    }

    /// Get urgent tasks (high or critical urgency)
    public var urgentTasks: [ComplianceTask] {
        return activeTasks.filter { task in
            task.urgency == .high || task.urgency == .critical
        }
    }

    /// Get tasks by category
    public func tasks(category: TaskCategory) -> [ComplianceTask] {
        return activeTasks.filter { $0.category == category }
    }

    /// Get tasks by type
    public func tasks(type: TaskType) -> [ComplianceTask] {
        return activeTasks.filter { $0.type == type }
    }

    /// Get recruiter-visible tasks
    public var recruiterVisibleTasks: [ComplianceTask] {
        return activeTasks.filter { $0.recruiterVisible }
    }

    /// Start background refresh timer
    public func startBackgroundRefresh() {
        stopBackgroundRefresh()

        detectionTimer = Timer.scheduledTimer(withTimeInterval: backgroundRefreshInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.detectTasks()
            }
        }
    }

    /// Stop background refresh timer
    public func stopBackgroundRefresh() {
        detectionTimer?.invalidate()
        detectionTimer = nil
    }

    /// Update tasks from push notification (backend-driven)
    public func updateTasksFromPush(_ pushTasks: [ComplianceTask]) {
        // Merge push tasks with existing tasks
        tasks = mergeTasks(existing: tasks, new: pushTasks)

        // Re-detect to ensure consistency
        Task {
            await detectTasks()
        }
    }

    // MARK: - Task Detection

    private func detectTasksForCredential(_ credential: VerifiableCredential) async -> [ComplianceTask] {
        var tasks: [ComplianceTask] = []

        // Check for expiring credentials
        if credential.isExpiringSoon || credential.isExpired {
            let daysUntilExpiry = credential.expirationDate.map { daysBetween(Date(), $0) } ?? 0
            let urgency = determineUrgency(daysUntilExpiry: daysUntilExpiry, isExpired: credential.isExpired)

            let credentialType = credential.credentialSubject.type ?? "credential"
            let trustImpact = rulesLibrary.trustImpactForLicenseRenewal(daysUntilExpiry: daysUntilExpiry)
            let matchImpact = rulesLibrary.matchScoreImpactForLicense(daysUntilExpiry: daysUntilExpiry, isExpired: credential.isExpired)

            let task = ComplianceTask(
                type: .credentialExpiring,
                urgency: urgency,
                dueDate: credential.expirationDate,
                trustImpactScore: trustImpact,
                actionRoute: .renewLicense,
                title: "\(credentialType.capitalized) Expiring",
                description: credential.isExpired
                    ? "Your \(credentialType) has expired and needs renewal."
                    : "Your \(credentialType) expires in \(daysUntilExpiry) days.",
                category: .credential,
                credentialId: credential.id,
                matchScoreImpact: matchImpact,
                recruiterVisible: rulesLibrary.shouldBeVisibleToRecruiters(taskType: .credentialExpiring),
                metadata: ["credentialType": credentialType]
            )
            tasks.append(task)
        }

        // Check for missing evidence
        if let evidence = credential.evidence, evidence.isEmpty {
            let credentialType = credential.credentialSubject.type ?? "credential"
            if rulesLibrary.evidenceRequired(for: credentialType) {
                let trustImpact = rulesLibrary.trustImpactForMissingEvidence(credentialType: credentialType)

                let task = ComplianceTask(
                    type: .evidenceMissing,
                    urgency: .medium,
                    dueDate: nil,
                    trustImpactScore: abs(trustImpact),
                    actionRoute: .uploadEvidence,
                    title: "Missing Evidence for \(credentialType.capitalized)",
                    description: "Required evidence is missing for this credential.",
                    category: .evidence,
                    credentialId: credential.id,
                    matchScoreImpact: -0.08,
                    recruiterVisible: false,
                    metadata: ["credentialType": credentialType]
                )
                tasks.append(task)
            }
        }

        // Check for stale anchor
        if let anchorId = credential.chainAnchorId {
            // TODO: Check anchor staleness from ChainSnapshotStore
            // For now, we'll detect this in detectGlobalTasks
        }

        return tasks
    }

    private func detectGlobalTasks() async -> [ComplianceTask] {
        var tasks: [ComplianceTask] = []

        // TODO: Detect DEA renewal tasks (requires DEA credential)
        // TODO: Detect MATE Act training tasks
        // TODO: Detect CME requirement tasks
        // TODO: Detect sanctions check tasks
        // TODO: Detect chain snapshot check tasks

        return tasks
    }

    // MARK: - Helper Methods

    private func determineUrgency(daysUntilExpiry: Int, isExpired: Bool) -> Urgency {
        if isExpired {
            return .critical
        } else if daysUntilExpiry <= 7 {
            return .critical
        } else if daysUntilExpiry <= 30 {
            return .high
        } else if daysUntilExpiry <= 60 {
            return .medium
        } else {
            return .low
        }
    }

    private func daysBetween(_ start: Date, _ end: Date) -> Int {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: start, to: end)
        return components.day ?? 0
    }

    private func mergeTasks(existing: [ComplianceTask], new: [ComplianceTask]) -> [ComplianceTask] {
        var merged = existing

        for newTask in new {
            // Check if task already exists (by type, credentialId, and similar dueDate)
            let existingIndex = merged.firstIndex { existingTask in
                existingTask.type == newTask.type &&
                existingTask.credentialId == newTask.credentialId &&
                !existingTask.isCompleted
            }

            if let index = existingIndex {
                // Update existing task if new one is more urgent or has later due date
                let existingTask = merged[index]
                if newTask.urgency > existingTask.urgency ||
                   (newTask.dueDate != nil && existingTask.dueDate == nil) ||
                   (newTask.dueDate != nil && existingTask.dueDate != nil && newTask.dueDate! > existingTask.dueDate!) {
                    merged[index] = newTask
                }
            } else {
                // Add new task
                merged.append(newTask)
            }
        }

        // Remove completed tasks older than 30 days
        let thirtyDaysAgo = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        merged.removeAll { task in
            task.isCompleted &&
            task.completedAt != nil &&
            task.completedAt! < thirtyDaysAgo
        }

        return merged
    }

    private func detectHazards(from tasks: [ComplianceTask]) -> [IdentityHealthHazard] {
        var hazards: [IdentityHealthHazard] = []

        // Critical compliance expirations
        let criticalTasks = tasks.filter { task in
            task.urgency == .critical && !task.isCompleted
        }

        if !criticalTasks.isEmpty {
            let expiredCount = criticalTasks.filter { $0.isOverdue }.count
            let expiringCount = criticalTasks.filter { !$0.isOverdue && $0.urgency == .critical }.count

            if expiredCount > 0 {
                hazards.append(IdentityHealthHazard(
                    severity: .emergency,
                    message: "\(expiredCount) critical credential(s) have expired. Immediate action required.",
                    taskIds: criticalTasks.map { $0.id }
                ))
            } else if expiringCount > 0 {
                hazards.append(IdentityHealthHazard(
                    severity: .critical,
                    message: "\(expiringCount) critical credential(s) expiring soon. Renewal needed.",
                    taskIds: criticalTasks.map { $0.id }
                ))
            }
        }

        // Multiple high-urgency tasks
        let highUrgencyTasks = tasks.filter { task in
            task.urgency == .high && !task.isCompleted
        }

        if highUrgencyTasks.count >= 3 {
            hazards.append(IdentityHealthHazard(
                severity: .warning,
                message: "\(highUrgencyTasks.count) high-priority tasks require attention.",
                taskIds: highUrgencyTasks.map { $0.id }
            ))
        }

        return hazards
    }

    private func recalculateTrustScore() async {
        // Recalculate trust scores after task completion (Task 31)
        // This triggers trust score updates across the app
        await credentialStore.loadCredentials()
        let credentials = credentialStore.getAllCredentials()

        // Notify trust event bus of score changes
        for credential in credentials {
            // Calculate new trust score based on completed tasks
            let relatedTasks = tasks.filter { $0.credentialId == credential.id && $0.isCompleted }
            let trustBoost = relatedTasks.reduce(0.0) { $0 + $1.trustImpactScore }

            // Publish trust score change event (Task 31)
            // Note: Using .manual as source since complianceTask may not exist in TrustSource enum
            TrustEventBus.shared.updateTrust(
                credentialId: credential.id,
                score: trustBoost,
                source: .manual, // Compliance task completion
                metadata: ["taskIds": relatedTasks.map { $0.id }, "source": "complianceTask"]
            )
        }

        // Update app badge (Task 32)
        await updateAppBadge()
    }

    private func updateAppBadge() async {
        let urgentCount = urgentTasks.count
        await MainActor.run {
            UIApplication.shared.applicationIconBadgeNumber = urgentCount
        }
    }

    private func setupObservers() {
        // Observe credential store changes
        // When credentials are added/updated, re-detect tasks
        NotificationCenter.default.publisher(for: NSNotification.Name("CredentialsUpdated"))
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.detectTasks()
                }
            }
            .store(in: &cancellables)
    }
}

