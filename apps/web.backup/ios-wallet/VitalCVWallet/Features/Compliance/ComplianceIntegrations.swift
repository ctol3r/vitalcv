//
//  ComplianceIntegrations.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 5, Tasks 33-39
//  Integration with Profile, Wallet, Jobs, Recruiter
//

import SwiftUI

// MARK: - Pending Tasks Chip (Task 33)

struct PendingTasksChip: View {
    @StateObject private var engine = ComplianceTaskEngine.shared

    var body: some View {
        let pendingCount = engine.activeTasks.count

        if pendingCount > 0 {
            NavigationLink(destination: ComplianceTodoListView()) {
                HStack(spacing: WalletSpacing.xs) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)

                    Text("\(pendingCount) Pending")
                        .font(WalletTypography.caption)
                        .fontWeight(.semibold)
                }
                .foregroundColor(pendingCount > 5 ? .walletError : .walletWarning)
                .padding(.horizontal, WalletSpacing.sm)
                .padding(.vertical, WalletSpacing.xs)
                .background(
                    Capsule()
                        .fill(pendingCount > 5 ? Color.walletError.opacity(0.1) : Color.walletWarning.opacity(0.1))
                        .overlay(
                            Capsule()
                                .stroke(pendingCount > 5 ? Color.walletError : Color.walletWarning, lineWidth: 1)
                        )
                )
            }
        }
    }
}

// MARK: - Wallet Tab Badge (Task 34)

struct WalletTabBadge: View {
    @StateObject private var engine = ComplianceTaskEngine.shared

    var credentialIssuesCount: Int {
        engine.tasks(category: .credential).count
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Your existing wallet content

            if credentialIssuesCount > 0 {
                Text("\(credentialIssuesCount)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .padding(4)
                    .background(
                        Circle()
                            .fill(Color.walletError)
                    )
                    .offset(x: 8, y: -8)
            }
        }
    }
}

// MARK: - Jobs Portal CTA (Task 35)

struct TasksAffectingMatchesCTA: View {
    @StateObject private var engine = ComplianceTaskEngine.shared

    var tasksAffectingMatches: [ComplianceTask] {
        engine.activeTasks.filter { task in
            task.matchScoreImpact != nil && task.matchScoreImpact! < 0
        }
    }

    var body: some View {
        if !tasksAffectingMatches.isEmpty {
            VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.walletWarning)

                    Text("Tasks Affecting Your Matches")
                        .font(WalletTypography.headline)
                        .foregroundColor(.walletTextPrimary)
                }

                Text("\(tasksAffectingMatches.count) task\(tasksAffectingMatches.count == 1 ? "" : "s") are lowering your job match score. Complete them to improve your visibility.")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)

                NavigationLink(destination: ComplianceTodoListView()) {
                    Text("View Tasks")
                        .font(WalletTypography.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(WalletSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                .fill(Color.walletPrimary)
                        )
                }
            }
            .padding(WalletSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                    .fill(Color.walletWarning.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                            .stroke(Color.walletWarning.opacity(0.3), lineWidth: 1)
                    )
            )
        }
    }
}

// MARK: - Recruiter-Triggered Tasks (Task 36)

extension ComplianceTaskEngine {
    /// Create recruiter-triggered task
    public func createRecruiterTask(
        recruiterId: String,
        requestType: RecruiterRequestType,
        credentialId: String? = nil
    ) async {
        let task: ComplianceTask

        switch requestType {
        case .updatedDEA:
            task = ComplianceTask(
                type: .recruiterRequest,
                urgency: .high,
                dueDate: Calendar.current.date(byAdding: .day, value: 7, to: Date()),
                trustImpactScore: 0.10,
                actionRoute: .updateDEA,
                title: "Recruiter Requested Updated DEA",
                description: "A recruiter has requested your updated DEA registration.",
                category: .recruiter,
                credentialId: credentialId,
                recruiterVisible: true,
                metadata: ["recruiterId": recruiterId, "requestType": "updatedDEA"]
            )

        case .evidence:
            task = ComplianceTask(
                type: .recruiterRequest,
                urgency: .medium,
                dueDate: Calendar.current.date(byAdding: .day, value: 14, to: Date()),
                trustImpactScore: 0.08,
                actionRoute: .uploadEvidence,
                title: "Recruiter Requested Evidence",
                description: "A recruiter has requested evidence for your credential.",
                category: .recruiter,
                credentialId: credentialId,
                recruiterVisible: true,
                metadata: ["recruiterId": recruiterId, "requestType": "evidence"]
            )
        }

        // Add task to engine
        tasks.append(task)
    }
}

enum RecruiterRequestType {
    case updatedDEA
    case evidence
}

// MARK: - Job-Critical Tasks (Task 37)

extension ComplianceTaskEngine {
    /// Create job-critical task
    public func createJobCriticalTask(
        jobId: String,
        requirement: String,
        urgency: Urgency = .high
    ) async {
        let task = ComplianceTask(
            type: .jobCritical,
            urgency: urgency,
            dueDate: Calendar.current.date(byAdding: .day, value: 30, to: Date()),
            trustImpactScore: 0.12,
            actionRoute: .viewJob,
            title: "Job Requirement: \(requirement)",
            description: "This role requires \(requirement). Complete this to be eligible.",
            category: .job,
            recruiterVisible: true,
            metadata: ["jobId": jobId, "requirement": requirement]
        )

        tasks.append(task)
    }
}

// MARK: - Chain Snap Check Tasks (Task 38)

extension ComplianceTaskEngine {
    /// Detect and create chain snapshot check tasks
    public func detectChainSnapCheckTasks() async {
        await credentialStore.loadCredentials()
        let credentials = credentialStore.getAllCredentials()

        // TODO: Integrate with ChainSnapshotStore to check for outdated chain events
        // For now, create placeholder task detection

        for credential in credentials {
            if let anchorId = credential.chainAnchorId {
                // Check if chain snapshot is outdated
                // This would integrate with ChainSnapshotStore
                let staleTasks = tasks.filter {
                    $0.type == .chainSnapCheck && $0.credentialId == credential.id
                }

                if staleTasks.isEmpty {
                    // Create chain snap check task
                    let task = ComplianceTask(
                        type: .chainSnapCheck,
                        urgency: .medium,
                        dueDate: nil,
                        trustImpactScore: 0.05,
                        actionRoute: .refreshAnchor,
                        title: "Refresh Chain Snapshot",
                        description: "Chain snapshot for this credential may be outdated. Refresh to maintain trust.",
                        category: .chain,
                        credentialId: credential.id,
                        metadata: ["anchorId": anchorId]
                    )

                    tasks.append(task)
                }
            }
        }
    }
}

// MARK: - Queue Integration (Task 39)

struct CredentialingDashboardTaskPrompts: View {
    @StateObject private var engine = ComplianceTaskEngine.shared

    var body: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            Text("Credentialing Dashboard")
                .font(WalletTypography.title2)
                .foregroundColor(.walletTextPrimary)

            // Show relevant tasks for credentialing
            let credentialingTasks = engine.activeTasks.filter { task in
                task.category == .credential ||
                task.category == .compliance ||
                task.type == .licenseRenewal ||
                task.type == .dea ||
                task.type == .sanctionsCheck
            }

            if !credentialingTasks.isEmpty {
                Text("Complete these tasks to streamline your credentialing process:")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)

                ForEach(credentialingTasks.prefix(5)) { task in
                    NavigationLink(destination: ComplianceTaskDetailView(task: task)) {
                        HStack {
                            VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                                Text(task.title)
                                    .font(WalletTypography.headline)
                                    .foregroundColor(.walletTextPrimary)

                                Text(task.description)
                                    .font(WalletTypography.caption)
                                    .foregroundColor(.walletTextSecondary)
                                    .lineLimit(2)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .foregroundColor(.walletTextSecondary)
                        }
                        .padding(WalletSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: WalletCornerRadius.small)
                                .fill(Color.walletCard)
                                .walletShadow(WalletShadow.small)
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                }

                if credentialingTasks.count > 5 {
                    NavigationLink(destination: ComplianceTodoListView()) {
                        Text("View All \(credentialingTasks.count) Tasks")
                            .font(WalletTypography.body)
                            .foregroundColor(.walletPrimary)
                    }
                }
            } else {
                Text("No pending credentialing tasks. You're all set!")
                    .font(WalletTypography.body)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding(WalletSpacing.md)
    }
}

#Preview {
    VStack {
        PendingTasksChip()
        TasksAffectingMatchesCTA()
    }
    .padding()
}

