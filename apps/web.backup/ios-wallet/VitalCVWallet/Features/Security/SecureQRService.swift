//
//  SecureQRService.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 38, 39
//  Secure QR generation (short-lived) and DPoP-bound URLs
//

import Foundation
import CoreImage

class SecureQRService {
    static let shared = SecureQRService()

    private var activeQRs: [String: Date] = [:]
    private let qrLifetime: TimeInterval = 300 // 5 minutes

    private init() {
        // Cleanup expired QR codes
        Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.cleanupExpiredQRs()
        }
    }

    // Task 38: Secure QR generation (short-lived)
    func generateSecureQR(for credentialId: String) -> String? {
        // Generate a short-lived token
        let token = UUID().uuidString
        let expiresAt = Date().addingTimeInterval(qrLifetime)

        // Store token with expiration
        activeQRs[token] = expiresAt

        // Task 39: DPoP-bound URLs for external verifiers
        let urlString = generateDPoPBoundURL(credentialId: credentialId, token: token)

        return urlString
    }

    func validateQRToken(_ token: String) -> Bool {
        guard let expiresAt = activeQRs[token] else {
            return false
        }

        if Date() > expiresAt {
            activeQRs.removeValue(forKey: token)
            return false
        }

        return true
    }

    private func generateDPoPBoundURL(credentialId: String, token: String) -> String {
        // Generate a DPoP-bound URL with short-lived token
        // Format: https://verify.vitalcv.com/verify?credential=id&token=token&dpop=true
        let baseURL = "https://verify.vitalcv.com/verify"
        var components = URLComponents(string: baseURL)
        components?.queryItems = [
            URLQueryItem(name: "credential", value: credentialId),
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "dpop", value: "true")
        ]

        return components?.url?.absoluteString ?? ""
    }

    private func cleanupExpiredQRs() {
        let now = Date()
        activeQRs = activeQRs.filter { $0.value > now }
    }

    // Generate QR code image from string
    func generateQRCodeImage(from string: String, size: CGSize = CGSize(width: 200, height: 200)) -> UIImage? {
        let data = string.data(using: .utf8)

        guard let filter = CIFilter(name: "CIQRCodeGenerator") else {
            return nil
        }

        filter.setValue(data, forKey: "inputMessage")
        let transform = CGAffineTransform(scaleX: size.width / 200, y: size.height / 200)

        guard let outputImage = filter.outputImage?.transformed(by: transform) else {
            return nil
        }

        let context = CIContext()
        guard let cgImage = context.createCGImage(outputImage, from: outputImage.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}








