//
//  DynamicType.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 2
//  Full accessibility support with dynamic type scaling
//

import SwiftUI

/// Dynamic type scaling configuration
struct DynamicTypeConfig {
    static let minScale: CGFloat = 0.8
    static let maxScale: CGFloat = 1.5
    static let defaultScale: CGFloat = 1.0
}

/// View modifier for dynamic type scaling
struct DynamicTypeModifier: ViewModifier {
    @Environment(\.sizeCategory) var sizeCategory
    var scale: CGFloat = 1.0
    var minScale: CGFloat = DynamicTypeConfig.minScale
    var maxScale: CGFloat = DynamicTypeConfig.maxScale

    func body(content: Content) -> some View {
        content
            .font(.system(size: baseSize * scaleFactor))
            .minimumScaleFactor(minScale)
            .lineLimit(nil)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var baseSize: CGFloat {
        switch sizeCategory {
        case .extraSmall: return 12
        case .small: return 14
        case .medium: return 16
        case .large: return 17
        case .extraLarge: return 19
        case .extraExtraLarge: return 21
        case .extraExtraExtraLarge: return 23
        case .accessibilityMedium: return 28
        case .accessibilityLarge: return 33
        case .accessibilityExtraLarge: return 40
        case .accessibilityExtraExtraLarge: return 47
        case .accessibilityExtraExtraExtraLarge: return 53
        @unknown default: return 17
        }
    }

    private var scaleFactor: CGFloat {
        min(max(scale, minScale), maxScale)
    }
}

extension View {
    /// Apply dynamic type scaling
    func dynamicType(scale: CGFloat = 1.0, minScale: CGFloat = DynamicTypeConfig.minScale, maxScale: CGFloat = DynamicTypeConfig.maxScale) -> some View {
        modifier(DynamicTypeModifier(scale: scale, minScale: minScale, maxScale: maxScale))
    }
}

/// Accessibility-aware typography that scales with system settings
extension WalletTypography {
    static func scaled(_ baseFont: Font, category: ContentSizeCategory = .large) -> Font {
        let baseSize: CGFloat
        switch category {
        case .extraSmall: baseSize = 10
        case .small: baseSize = 12
        case .medium: baseSize = 14
        case .large: baseSize = 17
        case .extraLarge: baseSize = 19
        case .extraExtraLarge: baseSize = 21
        case .extraExtraExtraLarge: baseSize = 23
        case .accessibilityMedium: baseSize = 28
        case .accessibilityLarge: baseSize = 33
        case .accessibilityExtraLarge: baseSize = 40
        case .accessibilityExtraExtraLarge: baseSize = 47
        case .accessibilityExtraExtraExtraLarge: baseSize = 53
        @unknown default: baseSize = 17
        }

        // Extract size from base font if possible
        if let descriptor = baseFont as? Font {
            return .system(size: baseSize, weight: .regular, design: .default)
        }
        return baseFont
    }
}

/// Accessibility container that respects user preferences
struct AccessibilityContainer<Content: View>: View {
    @Environment(\.sizeCategory) var sizeCategory
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @Environment(\.accessibilityReduceTransparency) var reduceTransparency
    @Environment(\.colorScheme) var colorScheme

    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .environment(\.sizeCategory, sizeCategory)
            .animation(reduceMotion ? nil : .default, value: sizeCategory)
    }
}

/// Dynamic type preview helper
struct DynamicTypePreview: ViewModifier {
    let category: ContentSizeCategory

    func body(content: Content) -> some View {
        content
            .environment(\.sizeCategory, category)
    }
}

extension View {
    func previewDynamicType(_ category: ContentSizeCategory) -> some View {
        modifier(DynamicTypePreview(category: category))
    }
}

