//
//  ComplianceTask.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 1, Task 2
//  ComplianceTask model with type, urgency, dueDate, trustImpactScore, actionRoute
//

import Foundation

/// ComplianceTask - Represents a compliance-related task for clinicians
public struct ComplianceTask: Identifiable, Codable, Equatable {
    public let id: String
    public let type: TaskType
    public let urgency: Urgency
    public let dueDate: Date?
    public let trustImpactScore: Double // 0.0 - 1.0, impact on trustScore when completed
    public let actionRoute: ActionRoute
    public let title: String
    public let description: String
    public let category: TaskCategory
    public let credentialId: String? // Linked credential if applicable
    public let createdAt: Date
    public let updatedAt: Date
    public let isCompleted: Bool
    public let completedAt: Date?
    public let snoozedUntil: Date?
    public let matchScoreImpact: Double? // Impact on matchScore (negative = lowers score)
    public let recruiterVisible: Bool // Whether recruiters can see this task
    public let metadata: [String: String] // Additional metadata

    public init(
        id: String = UUID().uuidString,
        type: TaskType,
        urgency: Urgency,
        dueDate: Date?,
        trustImpactScore: Double,
        actionRoute: ActionRoute,
        title: String,
        description: String,
        category: TaskCategory,
        credentialId: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        isCompleted: Bool = false,
        completedAt: Date? = nil,
        snoozedUntil: Date? = nil,
        matchScoreImpact: Double? = nil,
        recruiterVisible: Bool = false,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.type = type
        self.urgency = urgency
        self.dueDate = dueDate
        self.trustImpactScore = trustImpactScore
        self.actionRoute = actionRoute
        self.title = title
        self.description = description
        self.category = category
        self.credentialId = credentialId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isCompleted = isCompleted
        self.completedAt = completedAt
        self.snoozedUntil = snoozedUntil
        self.matchScoreImpact = matchScoreImpact
        self.recruiterVisible = recruiterVisible
        self.metadata = metadata
    }

    /// Days until due date (negative if overdue)
    public var daysUntilDue: Int? {
        guard let dueDate = dueDate else { return nil }
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: Date(), to: dueDate)
        return components.day
    }

    /// Is task overdue
    public var isOverdue: Bool {
        guard let dueDate = dueDate else { return false }
        return dueDate < Date() && !isCompleted
    }

    /// Is task snoozed
    public var isSnoozed: Bool {
        guard let snoozedUntil = snoozedUntil else { return false }
        return snoozedUntil > Date()
    }
}

// MARK: - Task Type

public enum TaskType: String, Codable, CaseIterable {
    case licenseRenewal = "licenseRenewal"
    case dea = "dea"
    case mate = "mate"
    case cme = "cme"
    case evidenceMissing = "evidenceMissing"
    case anchorStale = "anchorStale"
    case sanctionsCheck = "sanctionsCheck"
    case credentialExpiring = "credentialExpiring"
    case chainSnapCheck = "chainSnapCheck"
    case recruiterRequest = "recruiterRequest"
    case jobCritical = "jobCritical"

    public var displayName: String {
        switch self {
        case .licenseRenewal: return "License Renewal"
        case .dea: return "DEA Registration"
        case .mate: return "MATE Act Training"
        case .cme: return "CME Requirements"
        case .evidenceMissing: return "Missing Evidence"
        case .anchorStale: return "Stale Anchor"
        case .sanctionsCheck: return "Sanctions Check"
        case .credentialExpiring: return "Credential Expiring"
        case .chainSnapCheck: return "Chain Snapshot Check"
        case .recruiterRequest: return "Recruiter Request"
        case .jobCritical: return "Job Critical"
        }
    }

    public var icon: String {
        switch self {
        case .licenseRenewal: return "doc.text.fill"
        case .dea: return "shield.fill"
        case .mate: return "book.fill"
        case .cme: return "graduationcap.fill"
        case .evidenceMissing: return "doc.badge.plus"
        case .anchorStale: return "link.badge.plus"
        case .sanctionsCheck: return "checkmark.shield.fill"
        case .credentialExpiring: return "clock.fill"
        case .chainSnapCheck: return "link.circle.fill"
        case .recruiterRequest: return "person.2.fill"
        case .jobCritical: return "briefcase.fill"
        }
    }
}

// MARK: - Urgency

public enum Urgency: String, Codable, CaseIterable, Comparable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case critical = "critical"

    public static func < (lhs: Urgency, rhs: Urgency) -> Bool {
        let order: [Urgency] = [.low, .medium, .high, .critical]
        guard let lhsIndex = order.firstIndex(of: lhs),
              let rhsIndex = order.firstIndex(of: rhs) else {
            return false
        }
        return lhsIndex < rhsIndex
    }

    public var color: String {
        switch self {
        case .low: return "blue"
        case .medium: return "orange"
        case .high: return "red"
        case .critical: return "purple"
        }
    }

    public var priority: Int {
        switch self {
        case .low: return 1
        case .medium: return 2
        case .high: return 3
        case .critical: return 4
        }
    }
}

// MARK: - Task Category

public enum TaskCategory: String, Codable, CaseIterable {
    case credential = "credential"
    case compliance = "compliance"
    case evidence = "evidence"
    case chain = "chain"
    case recruiter = "recruiter"
    case job = "job"

    public var displayName: String {
        switch self {
        case .credential: return "Credential"
        case .compliance: return "Compliance"
        case .evidence: return "Evidence"
        case .chain: return "Chain"
        case .recruiter: return "Recruiter"
        case .job: return "Job"
        }
    }
}

// MARK: - Action Route

public enum ActionRoute: String, Codable {
    case renewLicense = "renewLicense"
    case uploadEvidence = "uploadEvidence"
    case reverifyCredential = "reverifyCredential"
    case updateDEA = "updateDEA"
    case updateMATE = "updateMATE"
    case checkSanctions = "checkSanctions"
    case refreshAnchor = "refreshAnchor"
    case completeCME = "completeCME"
    case viewCredential = "viewCredential"
    case viewJob = "viewJob"
    case contactRecruiter = "contactRecruiter"

    public var displayName: String {
        switch self {
        case .renewLicense: return "Renew License"
        case .uploadEvidence: return "Upload Evidence"
        case .reverifyCredential: return "Re-verify Credential"
        case .updateDEA: return "Update DEA"
        case .updateMATE: return "Update MATE"
        case .checkSanctions: return "Check Sanctions"
        case .refreshAnchor: return "Refresh Anchor"
        case .completeCME: return "Complete CME"
        case .viewCredential: return "View Credential"
        case .viewJob: return "View Job"
        case .contactRecruiter: return "Contact Recruiter"
        }
    }
}

// MARK: - Identity Health Hazard

public struct IdentityHealthHazard: Identifiable, Codable {
    public let id: String
    public let severity: HazardSeverity
    public let message: String
    public let taskIds: [String] // Related task IDs
    public let createdAt: Date

    public init(
        id: String = UUID().uuidString,
        severity: HazardSeverity,
        message: String,
        taskIds: [String],
        createdAt: Date = Date()
    ) {
        self.id = id
        self.severity = severity
        self.message = message
        self.taskIds = taskIds
        self.createdAt = createdAt
    }
}

public enum HazardSeverity: String, Codable, Comparable {
    case warning = "warning"
    case critical = "critical"
    case emergency = "emergency"

    public static func < (lhs: HazardSeverity, rhs: HazardSeverity) -> Bool {
        let order: [HazardSeverity] = [.warning, .critical, .emergency]
        guard let lhsIndex = order.firstIndex(of: lhs),
              let rhsIndex = order.firstIndex(of: rhs) else {
            return false
        }
        return lhsIndex < rhsIndex
    }
}

