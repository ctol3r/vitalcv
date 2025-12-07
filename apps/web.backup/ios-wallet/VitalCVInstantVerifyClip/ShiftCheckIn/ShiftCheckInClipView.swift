//
//  ShiftCheckInClipView.swift
//  VitalCVInstantVerifyClip
//
//  Created: Hospital Scheduling & Shift Credentialing - Phase 5, Task 35
//  App Clip integration for in-person shift check-in
//

import SwiftUI

struct ShiftCheckInClipView: View {
    @StateObject private var viewModel = ShiftCheckInClipViewModel()
    @EnvironmentObject var clipState: AppClipState

    var body: some View {
        VStack(spacing: 24) {
            // Header
            VStack(spacing: 8) {
                Image(systemName: "clock.badge.checkmark")
                    .font(.system(size: 64))
                    .foregroundColor(.blue)

                Text("Shift Check-In")
                    .font(.title)
                    .fontWeight(.bold)

                Text("Verify your credentials to check in")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()

            // QR Code Display (for clinician to scan)
            if let qrCode = viewModel.clinicianQRCode {
                VStack(spacing: 12) {
                    Text("Scan this QR code at the nurse station")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    // QR Code Image (would generate actual QR)
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.white)
                        .frame(width: 200, height: 200)
                        .overlay(
                            Text("QR Code")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        )
                        .shadow(radius: 8)
                }
                .padding()
            } else {
                Button(action: {
                    viewModel.generateQRCode()
                }) {
                    HStack {
                        Image(systemName: "qrcode")
                        Text("Generate Check-In QR")
                    }
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.blue)
                    )
                }
                .padding()
            }

            // Check-In Status
            if viewModel.isCheckedIn {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.green)

                    Text("Checked In Successfully")
                        .font(.headline)
                        .foregroundColor(.green)

                    if let checkInTime = viewModel.checkInTime {
                        Text("Time: \(formattedTime(checkInTime))")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
            }
        }
        .padding()
    }

    private func formattedTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - View Model

@MainActor
class ShiftCheckInClipViewModel: ObservableObject {
    @Published var clinicianQRCode: String?
    @Published var isCheckedIn = false
    @Published var checkInTime: Date?

    func generateQRCode() {
        // Generate QR code with clinician ID and shift info
        // This would integrate with QR generation service
        clinicianQRCode = "vitalcv://shift-checkin/\(UUID().uuidString)"
    }

    func checkIn() {
        isCheckedIn = true
        checkInTime = Date()
    }
}

#Preview {
    ShiftCheckInClipView()
        .environmentObject(AppClipState.shared)
}

