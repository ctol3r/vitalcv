//
//  SafeAreaLayout.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 1
//  Global Safe Area adaptive layout for all devices
//

import SwiftUI

/// View modifier for safe area adaptive layout
struct SafeAreaAdaptive: ViewModifier {
    var edges: Edge.Set = .all
    var padding: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .safeAreaInset(edge: .top, spacing: 0) {
                if edges.contains(.top) {
                    Color.clear.frame(height: padding)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if edges.contains(.bottom) {
                    Color.clear.frame(height: padding)
                }
            }
            .safeAreaInset(edge: .leading, spacing: 0) {
                if edges.contains(.leading) {
                    Color.clear.frame(width: padding)
                }
            }
            .safeAreaInset(edge: .trailing, spacing: 0) {
                if edges.contains(.trailing) {
                    Color.clear.frame(width: padding)
                }
            }
    }
}

extension View {
    /// Apply safe area adaptive layout
    func safeAreaAdaptive(edges: Edge.Set = .all, padding: CGFloat = 0) -> some View {
        modifier(SafeAreaAdaptive(edges: edges, padding: padding))
    }

    /// Ignore safe area with adaptive padding
    func ignoreSafeAreaAdaptive(edges: Edge.Set = .all) -> some View {
        self.ignoresSafeArea(edges: edges)
    }
}

/// Device-specific safe area insets
struct DeviceSafeArea {
    static var top: CGFloat {
        if UIDevice.current.hasNotch {
            return 44 // iPhone X and later
        } else {
            return 20 // Older iPhones
        }
    }

    static var bottom: CGFloat {
        if UIDevice.current.hasNotch {
            return 34 // iPhone X and later
        } else {
            return 0 // Older iPhones
        }
    }

    static var horizontal: CGFloat {
        return 16 // Standard horizontal padding
    }
}

extension UIDevice {
    var hasNotch: Bool {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first else {
            return false
        }
        return window.safeAreaInsets.top > 20
    }
}

/// Container view that automatically handles safe areas
struct SafeAreaContainer<Content: View>: View {
    let content: Content
    var edges: Edge.Set = .all
    var padding: CGFloat = WalletSpacing.md

    init(edges: Edge.Set = .all, padding: CGFloat = WalletSpacing.md, @ViewBuilder content: () -> Content) {
        self.edges = edges
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        GeometryReader { geometry in
            content
                .padding(.top, edges.contains(.top) ? max(geometry.safeAreaInsets.top, padding) : 0)
                .padding(.bottom, edges.contains(.bottom) ? max(geometry.safeAreaInsets.bottom, padding) : 0)
                .padding(.leading, edges.contains(.leading) ? max(geometry.safeAreaInsets.leading, padding) : 0)
                .padding(.trailing, edges.contains(.trailing) ? max(geometry.safeAreaInsets.trailing, padding) : 0)
        }
    }
}

