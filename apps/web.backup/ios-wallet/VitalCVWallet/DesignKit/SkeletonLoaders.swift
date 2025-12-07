//
//  SkeletonLoaders.swift
//  VitalCVWallet
//
//  Created: Batch 134-A - Task 10
//  Universal skeleton loaders
//

import SwiftUI

// MARK: - Skeleton Modifier

struct SkeletonModifier: ViewModifier {
    @State private var isAnimating = false

    var color: Color = Color.gray.opacity(0.3)
    var highlightColor: Color = Color.gray.opacity(0.5)
    var animationDuration: Double = 1.5

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { geometry in
                    ZStack {
                        // Base color
                        RoundedRectangle(cornerRadius: 8)
                            .fill(color)

                        // Shimmer effect
                        RoundedRectangle(cornerRadius: 8)
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        color,
                                        highlightColor,
                                        color
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .offset(x: isAnimating ? geometry.size.width : -geometry.size.width)
                            .opacity(0.6)
                    }
                }
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: animationDuration)
                        .repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}

// MARK: - Skeleton View Components

struct SkeletonText: View {
    var width: CGFloat?
    var height: CGFloat = 16
    var cornerRadius: CGFloat = 4

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.gray.opacity(0.3))
            .frame(width: width, height: height)
            .modifier(SkeletonModifier())
    }
}

struct SkeletonCircle: View {
    var size: CGFloat = 40

    var body: some View {
        Circle()
            .fill(Color.gray.opacity(0.3))
            .frame(width: size, height: size)
            .modifier(SkeletonModifier())
    }
}

struct SkeletonRectangle: View {
    var width: CGFloat?
    var height: CGFloat
    var cornerRadius: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.gray.opacity(0.3))
            .frame(width: width, height: height)
            .modifier(SkeletonModifier())
    }
}

// MARK: - Preset Skeleton Loaders

struct CredentialCardSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                SkeletonCircle(size: 48)

                VStack(alignment: .leading, spacing: 8) {
                    SkeletonText(width: 120, height: 18)
                    SkeletonText(width: 80, height: 14)
                }

                Spacer()
            }

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                SkeletonText(width: .infinity, height: 14)
                SkeletonText(width: .infinity, height: 14)
                SkeletonText(width: 200, height: 14)
            }
        }
        .padding()
        .cardBackground(style: .standard)
    }
}

struct WalletGridSkeleton: View {
    let columns: Int
    let rows: Int

    init(columns: Int = 2, rows: Int = 3) {
        self.columns = columns
        self.rows = rows
    }

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: columns), spacing: 12) {
            ForEach(0..<(columns * rows), id: \.self) { _ in
                CredentialCardSkeleton()
            }
        }
    }
}

struct ListSkeleton: View {
    let count: Int

    init(count: Int = 5) {
        self.count = count
    }

    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<count, id: \.self) { _ in
                HStack(spacing: 12) {
                    SkeletonCircle(size: 40)

                    VStack(alignment: .leading, spacing: 6) {
                        SkeletonText(width: 150, height: 16)
                        SkeletonText(width: 100, height: 12)
                    }

                    Spacer()
                }
                .padding(.vertical, 8)
            }
        }
    }
}

struct DetailViewSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                SkeletonCircle(size: 60)

                VStack(alignment: .leading, spacing: 8) {
                    SkeletonText(width: 180, height: 20)
                    SkeletonText(width: 120, height: 14)
                }

                Spacer()
            }

            Divider()

            // Content sections
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    SkeletonText(width: 100, height: 16)
                    SkeletonText(width: .infinity, height: 14)
                    SkeletonText(width: .infinity, height: 14)
                    SkeletonText(width: 250, height: 14)
                }
            }
        }
        .padding()
    }
}

// MARK: - View Extension

extension View {
    /// Apply skeleton loading effect
    func skeleton(
        color: Color = Color.gray.opacity(0.3),
        highlightColor: Color = Color.gray.opacity(0.5),
        animationDuration: Double = 1.5
    ) -> some View {
        modifier(SkeletonModifier(
            color: color,
            highlightColor: highlightColor,
            animationDuration: animationDuration
        ))
    }
}








