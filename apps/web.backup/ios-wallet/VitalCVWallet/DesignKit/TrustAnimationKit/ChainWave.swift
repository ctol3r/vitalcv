//
//  ChainWave.swift
//  VitalCVWallet
//
//  Created: Trust Animation Kit - Phase 3, Task 19
//  Chain wave motion on timeline scroll
//

import SwiftUI

/// ChainWave - Wave motion animation for timeline scroll
struct ChainWave: View {
    let blockCount: Int
    let scrollOffset: CGFloat
    @State private var wavePhase: Double = 0.0

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(0..<blockCount, id: \.self) { index in
                    chainBlock(at: index, in: geometry.size)
                }
            }
            .onAppear {
                startWave()
            }
        }
    }

    private func chainBlock(at index: Int, in size: CGSize) -> some View {
        let blockSpacing = size.width / CGFloat(blockCount)
        let xPosition = CGFloat(index) * blockSpacing
        let waveOffset = sin(wavePhase + Double(index) * 0.5) * 20

        return RoundedRectangle(cornerRadius: 4)
            .fill(blockColor(for: index))
            .frame(width: blockSpacing - 4, height: 40)
            .offset(x: xPosition, y: waveOffset)
    }

    private func blockColor(for index: Int) -> Color {
        let phase = (Double(index) * 0.2 + wavePhase) / (2 * .pi)
        let normalizedPhase = phase - floor(phase)

        if normalizedPhase < 0.3 {
            return .trustEmerald
        } else if normalizedPhase < 0.6 {
            return .trustIndigo
        } else {
            return .walletTextSecondary.opacity(0.3)
        }
    }

    private func startWave() {
        withAnimation(
            Animation.linear(duration: 2.0)
                .repeatForever(autoreverses: false)
        ) {
            wavePhase = 2 * .pi
        }
    }
}

/// ChainTimelineView - Timeline view with wave animation
struct ChainTimelineView: View {
    let blocks: [ChainBlock]
    @State private var scrollPosition: CGFloat = 0
    @State private var wavePhase: Double = 0.0

    struct ChainBlock: Identifiable {
        let id: UUID
        let timestamp: Date
        let hash: String
        let isConfirmed: Bool
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(blocks) { block in
                    ChainBlockView(block: block, wavePhase: wavePhase)
                }
            }
            .padding(.horizontal, 16)
        }
        .onAppear {
            startWave()
        }
        .gesture(
            DragGesture()
                .onChanged { value in
                    scrollPosition = value.translation.width
                }
        )
    }

    private func startWave() {
        withAnimation(
            Animation.linear(duration: 3.0)
                .repeatForever(autoreverses: false)
        ) {
            wavePhase = 2 * .pi
        }
    }
}

struct ChainBlockView: View {
    let block: ChainTimelineView.ChainBlock
    let wavePhase: Double

    var body: some View {
        VStack(spacing: 8) {
            Circle()
                .fill(block.isConfirmed ? .trustEmerald : .walletTextSecondary.opacity(0.3))
                .frame(width: 12, height: 12)
                .offset(y: waveOffset)
                .shadow(
                    color: block.isConfirmed ? .trustEmerald.opacity(0.5) : .clear,
                    radius: 4,
                    x: 0,
                    y: 0
                )

            Text(block.hash.prefix(8))
                .font(WalletTypography.caption2)
                .foregroundColor(.walletTextSecondary)
        }
        .frame(width: 60)
    }

    private var waveOffset: CGFloat {
        CGFloat(sin(wavePhase + Double(block.hash.hashValue) * 0.01) * 8)
    }
}

extension View {
    /// Adds chain wave motion to timeline
    func chainWave(blockCount: Int, scrollOffset: CGFloat = 0) -> some View {
        overlay(
            ChainWave(blockCount: blockCount, scrollOffset: scrollOffset)
                .allowsHitTesting(false)
        )
    }
}

