//
//  SecurityService.swift
//  VitalCVWallet
//
//  Created: Batch 539 - Task 32
//  Tamper detection (jailbreak detection)
//

import Foundation
import UIKit
import CryptoKit

class SecurityService {
    static let shared = SecurityService()

    private init() {}

    // MARK: - Jailbreak Detection

    func isJailbroken() -> Bool {
        // Check for common jailbreak indicators
        let jailbreakPaths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/private/var/lib/apt/",
            "/private/var/lib/cydia",
            "/private/var/mobile/Library/SBSettings/Themes",
            "/private/var/tmp/cydia.log",
            "/Applications/RockApp.app",
            "/Applications/Icy.app",
            "/usr/bin/ssh",
            "/var/cache/apt",
            "/var/lib/apt",
            "/var/lib/cydia",
            "/usr/libexec/ssh-keysign",
            "/Applications/MxTube.app",
            "/Applications/IntelliScreen.app",
            "/Applications/FakeCarrier.app",
            "/Library/MobileSubstrate/DynamicLibraries/Veency.plist",
            "/Library/MobileSubstrate/DynamicLibraries/LiveClock.plist"
        ]

        for path in jailbreakPaths {
            if FileManager.default.fileExists(atPath: path) {
                return true
            }
        }

        // Check if app can write to restricted directories
        let testPath = "/private/jailbreak.txt"
        do {
            try "test".write(toFile: testPath, atomically: true, encoding: .utf8)
            try FileManager.default.removeItem(atPath: testPath)
            return true
        } catch {
            // Expected to fail on non-jailbroken devices
        }

        return false
    }

    // MARK: - Screenshot Detection

    func setupScreenshotDetection(handler: @escaping () -> Void) {
        NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification,
            object: nil,
            queue: .main
        ) { _ in
            handler()
        }
    }

    // MARK: - App Integrity

    func checkAppIntegrity() -> AppIntegrityStatus {
        if isJailbroken() {
            return .compromised
        }

        // Additional checks can be added here
        // - Code signing validation
        // - Runtime manipulation detection
        // - Debugger attachment

        return .secure
    }
}

enum AppIntegrityStatus {
    case secure
    case compromised
    case warning
}

// MARK: - Backup Encryption (Task 8)

extension SecurityService {
    func encryptBackup(_ data: Data) throws -> Data {
        // Use AES-256-GCM encryption
        // In production, use proper key derivation and secure key storage
        let key = SymmetricKey(size: .bits256)
        let sealedBox = try AES.GCM.seal(data, using: key)

        // Combine nonce + ciphertext + tag
        var encrypted = sealedBox.nonce.withUnsafeBytes { Data($0) }
        encrypted.append(sealedBox.ciphertext)
        encrypted.append(sealedBox.tag)

        return encrypted
    }

    func decryptBackup(_ encryptedData: Data) throws -> Data {
        // Extract nonce, ciphertext, and tag
        // Simplified - in production, use proper format
        let nonceSize = 12
        let tagSize = 16

        guard encryptedData.count > nonceSize + tagSize else {
            throw SecurityError.decryptionFailed
        }

        let nonce = encryptedData.prefix(nonceSize)
        let tag = encryptedData.suffix(tagSize)
        let ciphertext = encryptedData.dropFirst(nonceSize).dropLast(tagSize)

        // In production, retrieve key from secure storage
        let key = SymmetricKey(size: .bits256)
        let sealedBox = try AES.GCM.SealedBox(
            nonce: AES.GCM.Nonce(data: nonce),
            ciphertext: ciphertext,
            tag: tag
        )

        return try AES.GCM.open(sealedBox, using: key)
    }
}

enum SecurityError: LocalizedError {
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .decryptionFailed:
            return "Failed to decrypt backup data"
        }
    }
}

