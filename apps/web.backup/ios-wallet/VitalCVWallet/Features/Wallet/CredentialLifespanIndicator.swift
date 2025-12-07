//
//  CredentialLifespanIndicator.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 20
//  Credential lifespan progress indicator
//

import SwiftUI

/// CredentialLifespanIndicator - Shows credential expiration progress
struct CredentialLifespanIndicator: View {
    let credential: VerifiableCredential
    var showLabel: Bool = true
    var style: IndicatorStyle = .linear

    enum IndicatorStyle {
        case linear
        case circular
        case ring
    }

    private var progress: Double {
        guard let expirationDate = credential.expirationDate else { return 1.0 }
        let now = Date()
        let totalDuration = expirationDate.timeIntervalSince(credential.issuanceDate)
        let elapsed = now.timeIntervalSince(credential.issuanceDate)

        guard totalDuration > 0 else { return 1.0 }
        return max(0.0, min(1.0, elapsed / totalDuration))
    }

    private var daysRemaining: Int? {
        guard let expirationDate = credential.expirationDate else { return nil }
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: Date(), to: expirationDate)
        return components.day
    }

    private var progressColor: Color {
        if progress < 0.25 {
            return .walletSuccess
        } else if progress < 0.75 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if showLabel {
                HStack {
                    Text("Credential Lifespan")
                        .font(WalletTypography.subheadline)
                        .foregroundColor(.walletTextSecondary)

                    Spacer()

                    if let days = daysRemaining {
                        Text("\(days) days remaining")
                            .font(WalletTypography.caption)
                            .foregroundColor(progressColor)
                    } else {
                        Text("No expiration")
                            .font(WalletTypography.caption)
                            .foregroundColor(.walletTextSecondary)
                    }
                }
            }

            switch style {
            case .linear:
                LinearProgressView(progress: progress, color: progressColor)
            case .circular:
                CircularProgressView(progress: progress, color: progressColor)
            case .ring:
                RingProgressView(progress: progress, color: progressColor)
            }
        }
    }
}

// MARK: - Linear Progress View

struct LinearProgressView: View {
    let progress: Double
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 6)

                // Progress
                RoundedRectangle(cornerRadius: 4)
                    .fill(color)
                    .frame(width: geometry.size.width * progress, height: 6)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: progress)
            }
        }
        .frame(height: 6)
    }
}

// MARK: - Circular Progress View

struct CircularProgressView: View {
    let progress: Double
    let color: Color

    var body: some View {
        ZStack {
            // Background circle
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 6)

            // Progress circle
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    color,
                    style: StrokeStyle(lineWidth: 6, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: progress)
        }
        .frame(width: 60, height: 60)
    }
}

// MARK: - Ring Progress View

struct RingProgressView: View {
    let progress: Double
    let color: Color

    var body: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 8)

            // Progress ring
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AngularGradient(
                        colors: [color, color.opacity(0.5)],
                        center: .center,
                        startAngle: .degrees(-90),
                        endAngle: .degrees(270)
                    ),
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: progress)

            // Center text
            VStack(spacing: 2) {
                Text("\(Int(progress * 100))%")
                    .font(WalletTypography.headline)
                    .foregroundColor(color)

                Text("used")
                    .font(WalletTypography.caption2)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .frame(width: 80, height: 80)
    }
}








