//
//  NotificationExtensions.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 3
//  Notification extensions for Combine
//

import Foundation

extension Notification.Name {
    static let networkStatusChanged = Notification.Name("networkStatusChanged")
    static let credentialReceived = Notification.Name("credentialReceived")
    static let verificationCompleted = Notification.Name("verificationCompleted")
}

