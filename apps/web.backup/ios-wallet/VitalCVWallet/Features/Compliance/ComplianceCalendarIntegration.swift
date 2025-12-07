//
//  ComplianceCalendarIntegration.swift
//  VitalCVWallet
//
//  Created: Compliance To-Do Engine - Phase 4, Task 28
//  Calendar integration (iCal event creation for renewals)
//

import Foundation
import EventKit
import EventKitUI

/// ComplianceCalendarIntegration - Calendar integration for compliance tasks
@MainActor
public class ComplianceCalendarIntegration {
    public static let shared = ComplianceCalendarIntegration()

    private let eventStore = EKEventStore()

    private init() {}

    // MARK: - Public API

    /// Request calendar access
    public func requestAccess() async -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)

        switch status {
        case .authorized:
            return true
        case .notDetermined:
            return await eventStore.requestAccess(to: .event)
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }

    /// Create calendar event for task
    public func createEvent(for task: ComplianceTask) async throws -> EKEvent? {
        guard await requestAccess() else {
            throw CalendarError.accessDenied
        }

        guard let dueDate = task.dueDate else {
            throw CalendarError.noDueDate
        }

        let event = EKEvent(eventStore: eventStore)
        event.title = task.title
        event.notes = task.description
        event.startDate = dueDate
        event.endDate = Calendar.current.date(byAdding: .hour, value: 1, to: dueDate) ?? dueDate
        event.calendar = eventStore.defaultCalendarForNewEvents

        // Set reminder alerts
        let reminderDays = getReminderDays(for: task.type)
        for day in reminderDays {
            let alarm = EKAlarm(relativeOffset: -Double(day * 24 * 60 * 60)) // Days in seconds
            event.addAlarm(alarm)
        }

        // Set URL to open task in app
        if let url = createDeepLink(for: task) {
            event.url = url
        }

        do {
            try eventStore.save(event, span: .thisEvent)
            return event
        } catch {
            throw CalendarError.saveFailed(error)
        }
    }

    /// Create events for all urgent tasks
    public func createEventsForUrgentTasks() async throws -> [EKEvent] {
        let engine = ComplianceTaskEngine.shared
        let urgentTasks = engine.urgentTasks

        var createdEvents: [EKEvent] = []

        for task in urgentTasks {
            if let event = try? await createEvent(for: task) {
                createdEvents.append(event)
            }
        }

        return createdEvents
    }

    // MARK: - Helper Methods

    private func getReminderDays(for taskType: TaskType) -> [Int] {
        switch taskType {
        case .licenseRenewal, .dea:
            return [90, 60, 30, 14, 7, 1] // Multiple reminders
        case .cme, .mate:
            return [30, 14, 7] // Fewer reminders
        default:
            return [7, 1] // Default reminders
        }
    }

    private func createDeepLink(for task: ComplianceTask) -> URL? {
        // Create deep link to open task in app
        var components = URLComponents()
        components.scheme = "vitalcv"
        components.host = "compliance"
        components.path = "/task/\(task.id)"

        return components.url
    }
}

// MARK: - Errors

enum CalendarError: LocalizedError {
    case accessDenied
    case noDueDate
    case saveFailed(Error)

    var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "Calendar access denied. Please enable calendar access in Settings."
        case .noDueDate:
            return "Task does not have a due date."
        case .saveFailed(let error):
            return "Failed to save calendar event: \(error.localizedDescription)"
        }
    }
}

