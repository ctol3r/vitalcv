//
//  CredentialCard2.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Tasks 11-15
//  Credential Card 2.0 with animations, edge lighting, swipe actions, long-press
//

import SwiftUI

struct CredentialCard2: View {
    let credential: VerifiableCredential
    let onTap: () -> Void
    let onSwipeLeft: (() -> Void)? = nil  // Task 13: Show timeline
    let onSwipeRight: (() -> Void)? = nil  // Task 14: Verify

    @State private var isUnfolded = false
    @State private var dragOffset: CGSize = .zero
    @State private var isLongPressing = false
    @State private var showSummaryBubble = false

    // Task 12: Edge lighting based on trust score
    var trustScore: Double {
        // Calculate trust score based on credential properties
        var score: Double = 0.5

        if credential.proof != nil {
            score += 0.2
        }

        if !credential.isExpired && !credential.isExpiringSoon {
            score += 0.2
        }

        if let evidence = credential.evidence, !evidence.isEmpty {
            score += 0.1
        }

        return min(score, 1.0)
    }

    var edgeLightColor: Color {
        if trustScore >= 0.8 {
            return .walletSuccess
        } else if trustScore >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }

    var body: some View {
        ZStack {
            // Task 11: Animated fold/unfold transition
            cardContent
                .rotation3DEffect(
                    .degrees(isUnfolded ? 180 : 0),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 0.5
                )
                .animation(.spring(response: 0.6, dampingFraction: 0.8), value: isUnfolded)

            // Task 12: Edge lighting based on trust-score
            edgeLighting

            // Task 15: Long-press summary bubble
            if showSummaryBubble {
                summaryBubble
            }
        }
        .offset(dragOffset)
        .gesture(
            SimultaneousGesture(
                // Long press gesture
                LongPressGesture(minimumDuration: 0.5)
                    .onEnded { _ in
                        withAnimation(.spring()) {
                            showSummaryBubble = true
                            isLongPressing = true
                        }
                        HapticFeedbackService.shared.longPress()
                    },
                // Drag gesture for swipe actions
                DragGesture()
                    .onChanged { value in
                        dragOffset = value.translation

                        // Task 13 & 14: Swipe left/right detection
                        if abs(value.translation.width) > 50 {
                            HapticFeedbackService.shared.selectionChanged()
                        }
                    }
                    .onEnded { value in
                        // Task 13: Swipe left - show timeline
                        if value.translation.width < -100 && onSwipeLeft != nil {
                            withAnimation(.spring()) {
                                dragOffset = .init(width: -UIScreen.main.bounds.width, height: 0)
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                onSwipeLeft?()
                                dragOffset = .zero
                            }
                        }
                        // Task 14: Swipe right - verify
                        else if value.translation.width > 100 && onSwipeRight != nil {
                            withAnimation(.spring()) {
                                dragOffset = .init(width: UIScreen.main.bounds.width, height: 0)
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                onSwipeRight?()
                                dragOffset = .zero
                            }
                        }
                        // Reset if not enough swipe
                        else {
                            withAnimation(.spring()) {
                                dragOffset = .zero
                            }
                        }
                    }
            )
        )
        .simultaneousGesture(
            TapGesture()
                .onEnded { _ in
                    if !isLongPressing {
                        // Task 11: Toggle fold/unfold on tap
                        withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                            isUnfolded.toggle()
                        }
                        HapticFeedbackService.shared.cardTapped()
                        onTap()
                    }
                    isLongPressing = false
                    showSummaryBubble = false
                }
        )
    }

    // MARK: - Card Content

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.md) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: WalletSpacing.xs) {
                    Text(credential.type.first ?? "Credential")
                        .font(VitalCVFonts.headline)
                        .foregroundColor(.walletText)

                    Text(credential.issuer.name ?? credential.issuer.id)
                        .font(VitalCVFonts.subheadline)
                        .foregroundColor(.walletTextSecondary)
                }

                Spacer()

                statusBadge
            }

            // Expanded content (when unfolded)
            if isUnfolded {
                VStack(alignment: .leading, spacing: WalletSpacing.sm) {
                    Divider()

                    // Issued date
                    HStack {
                        VitalCVIcon(systemName: "calendar", size: 14, color: .walletTextSecondary)
                        Text("Issued: \(formatDate(credential.issuanceDate))")
                            .font(VitalCVFonts.caption1)
                            .foregroundColor(.walletTextSecondary)
                    }

                    // Expiration date
                    if let expirationDate = credential.expirationDate {
                        HStack {
                            VitalCVIcon(systemName: "clock", size: 14, color: .walletTextSecondary)
                            Text("Expires: \(formatDate(expirationDate))")
                                .font(VitalCVFonts.caption1)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }

                    // Evidence count
                    if let evidence = credential.evidence, !evidence.isEmpty {
                        HStack {
                            VitalCVIcon(systemName: VitalCVIcons.Credential.evidence, size: 14, color: .walletTextSecondary)
                            Text("\(evidence.count) evidence entries")
                                .font(VitalCVFonts.caption1)
                                .foregroundColor(.walletTextSecondary)
                        }
                    }

                    // Trust score indicator
                    HStack {
                        Text("Trust Score")
                            .font(VitalCVFonts.caption1)
                            .foregroundColor(.walletTextSecondary)
                        Spacer()
                        TrustScoreIndicator(score: trustScore)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(WalletSpacing.md)
        .frame(minHeight: isUnfolded ? 200 : 120)
        .background(Color.walletCard)
        .cornerRadius(WalletCornerRadius.large)
        .walletShadow(WalletShadow.medium)
    }

    // MARK: - Edge Lighting

    private var edgeLighting: some View {
        RoundedRectangle(cornerRadius: WalletCornerRadius.large)
            .stroke(
                LinearGradient(
                    colors: [
                        edgeLightColor.opacity(0.8),
                        edgeLightColor.opacity(0.4),
                        edgeLightColor.opacity(0.8)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 3
            )
            .blur(radius: 4)
            .opacity(isUnfolded ? 1.0 : 0.6)
            .animation(.easeInOut(duration: 0.3), value: isUnfolded)
    }

    // MARK: - Summary Bubble

    private var summaryBubble: some View {
        VStack(alignment: .leading, spacing: WalletSpacing.xs) {
            Text("Credential Summary")
                .font(VitalCVFonts.headline)
                .foregroundColor(.walletText)

            Text("Type: \(credential.type.joined(separator: ", "))")
                .font(VitalCVFonts.caption1)
                .foregroundColor(.walletTextSecondary)

            Text("Issuer: \(credential.issuer.name ?? credential.issuer.id)")
                .font(VitalCVFonts.caption1)
                .foregroundColor(.walletTextSecondary)

            Text("Trust Score: \(Int(trustScore * 100))%")
                .font(VitalCVFonts.caption1)
                .foregroundColor(.walletTextSecondary)
        }
        .padding(WalletSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
        )
        .offset(y: -80)
        .transition(.scale.combined(with: .opacity))
    }

    // MARK: - Status Badge

    private var statusBadge: some View {
        Group {
            if credential.isExpired {
                Badge(text: "Expired", color: .walletError)
            } else if credential.isExpiringSoon {
                Badge(text: "Expiring", color: .walletWarning)
            } else {
                Badge(text: "Active", color: .walletSuccess)
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

// MARK: - Trust Score Indicator

struct TrustScoreIndicator: View {
    let score: Double

    var body: some View {
        HStack(spacing: WalletSpacing.xs) {
            // Score bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.walletTextSecondary.opacity(0.2))
                        .frame(height: 8)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(scoreColor)
                        .frame(width: geometry.size.width * CGFloat(score), height: 8)
                }
            }
            .frame(width: 60, height: 8)

            // Score text
            Text("\(Int(score * 100))%")
                .font(VitalCVFonts.caption2)
                .foregroundColor(scoreColor)
        }
    }

    var scoreColor: Color {
        if score >= 0.8 {
            return .walletSuccess
        } else if score >= 0.5 {
            return .walletWarning
        } else {
            return .walletError
        }
    }
}

