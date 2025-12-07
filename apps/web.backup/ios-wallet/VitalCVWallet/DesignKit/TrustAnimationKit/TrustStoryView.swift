//
//  TrustStoryView.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 5, Task 34
//  Animated "why this is trusted" sequence
//

import SwiftUI

/// TrustStoryView - Animated narrative explaining why something is trusted
struct TrustStoryView: View {
    let story: TrustStory
    @State private var currentChapter: Int = 0
    @State private var isPlaying = false

    struct TrustStory {
        let title: String
        let chapters: [StoryChapter]
    }

    struct StoryChapter: Identifiable {
        let id: UUID
        let icon: String
        let title: String
        let description: String
        let trustEvidence: String
    }

    var body: some View {
        VStack(spacing: 24) {
            // Title
            Text(story.title)
                .font(WalletTypography.title1)
                .foregroundColor(.walletText)
                .padding(.top)

            // Chapter display
            if currentChapter < story.chapters.count {
                StoryChapterView(
                    chapter: story.chapters[currentChapter],
                    isVisible: isPlaying
                )
            }

            // Progress indicator
            HStack(spacing: 8) {
                ForEach(0..<story.chapters.count, id: \.self) { index in
                    Circle()
                        .fill(index <= currentChapter ? Color.trustEmerald : Color.walletTextSecondary.opacity(0.3))
                        .frame(width: 8, height: 8)
                        .scaleEffect(index == currentChapter ? 1.3 : 1.0)
                        .animation(TrustMotionConfig.responsiveSpring, value: currentChapter)
                }
            }
            .padding(.bottom)

            // Controls
            HStack(spacing: 16) {
                Button(action: previousChapter) {
                    Image(systemName: "chevron.left")
                        .foregroundColor(.walletText)
                }
                .disabled(currentChapter == 0)

                Button(action: togglePlay) {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .foregroundColor(.walletText)
                        .font(.system(size: 24))
                }

                Button(action: nextChapter) {
                    Image(systemName: "chevron.right")
                        .foregroundColor(.walletText)
                }
                .disabled(currentChapter >= story.chapters.count - 1)
            }
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.walletCard)
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
        )
    }

    private func togglePlay() {
        isPlaying.toggle()

        if isPlaying {
            autoAdvance()
        }
    }

    private func autoAdvance() {
        guard isPlaying else { return }

        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            if isPlaying && currentChapter < story.chapters.count - 1 {
                nextChapter()
                autoAdvance()
            } else {
                isPlaying = false
            }
        }
    }

    private func nextChapter() {
        guard currentChapter < story.chapters.count - 1 else { return }

        withAnimation(TrustMotionConfig.smoothSpring) {
            currentChapter += 1
        }

        TrustHapticEngine.shared.stepCompleted()
    }

    private func previousChapter() {
        guard currentChapter > 0 else { return }

        withAnimation(TrustMotionConfig.smoothSpring) {
            currentChapter -= 1
        }

        TrustHapticEngine.shared.stepCompleted()
    }
}

struct StoryChapterView: View {
    let chapter: TrustStoryView.StoryChapter
    let isVisible: Bool

    @State private var fadeIn = false
    @State private var slideOffset: CGFloat = 50

    var body: some View {
        VStack(spacing: 16) {
            // Icon
            Image(systemName: chapter.icon)
                .font(.system(size: 48, weight: .light))
                .foregroundColor(.trustEmerald)
                .scaleEffect(fadeIn ? 1.0 : 0.5)
                .opacity(fadeIn ? 1.0 : 0.0)

            // Title
            Text(chapter.title)
                .font(WalletTypography.title2)
                .foregroundColor(.walletText)
                .offset(y: slideOffset)
                .opacity(fadeIn ? 1.0 : 0.0)

            // Description
            Text(chapter.description)
                .font(WalletTypography.body)
                .foregroundColor(.walletTextSecondary)
                .multilineTextAlignment(.center)
                .offset(y: slideOffset)
                .opacity(fadeIn ? 1.0 : 0.0)

            // Trust evidence badge
            HStack(spacing: 8) {
                Image(systemName: "checkmark.shield.fill")
                    .foregroundColor(.trustEmerald)

                Text(chapter.trustEvidence)
                    .font(WalletTypography.caption)
                    .foregroundColor(.trustEmerald)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(Color.trustEmerald.opacity(0.1))
            )
            .offset(y: slideOffset)
            .opacity(fadeIn ? 1.0 : 0.0)
        }
        .onChange(of: isVisible) { visible in
            if visible {
                animateIn()
            }
        }
        .onAppear {
            if isVisible {
                animateIn()
            }
        }
    }

    private func animateIn() {
        fadeIn = false
        slideOffset = 50

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(TrustMotionConfig.smoothSpring) {
                fadeIn = true
                slideOffset = 0
            }
        }
    }
}

extension View {
    /// Shows animated trust story (why this is trusted)
    func trustStory(_ story: TrustStoryView.TrustStory) -> some View {
        overlay(
            TrustStoryView(story: story)
                .allowsHitTesting(false)
        )
    }
}

