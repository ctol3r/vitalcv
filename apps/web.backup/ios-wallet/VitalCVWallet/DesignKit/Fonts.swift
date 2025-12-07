//
//  Fonts.swift
//  VitalCVWallet
//
//  Created: Batch 545 - Task 3
//  Custom VitalCV font pack
//

import SwiftUI

/// VitalCV custom font system
struct VitalCVFonts {
    // MARK: - Font Family Names
    static let primaryFontName = "SF Pro Display"
    static let secondaryFontName = "SF Pro Text"
    static let monospaceFontName = "SF Mono"

    // MARK: - Custom Font Sizes
    struct Size {
        static let display: CGFloat = 48
        static let hero: CGFloat = 36
        static let title1: CGFloat = 28
        static let title2: CGFloat = 22
        static let title3: CGFloat = 20
        static let headline: CGFloat = 17
        static let body: CGFloat = 17
        static let callout: CGFloat = 16
        static let subheadline: CGFloat = 15
        static let footnote: CGFloat = 13
        static let caption1: CGFloat = 12
        static let caption2: CGFloat = 11
    }

    // MARK: - Custom Font Weights
    struct Weight {
        static let ultraLight = Font.Weight.ultraLight
        static let thin = Font.Weight.thin
        static let light = Font.Weight.light
        static let regular = Font.Weight.regular
        static let medium = Font.Weight.medium
        static let semibold = Font.Weight.semibold
        static let bold = Font.Weight.bold
        static let heavy = Font.Weight.heavy
        static let black = Font.Weight.black
    }

    // MARK: - Typography Styles
    static var display: Font {
        .system(size: Size.display, weight: .bold, design: .default)
    }

    static var hero: Font {
        .system(size: Size.hero, weight: .bold, design: .default)
    }

    static var title1: Font {
        .system(size: Size.title1, weight: .bold, design: .default)
    }

    static var title2: Font {
        .system(size: Size.title2, weight: .semibold, design: .default)
    }

    static var title3: Font {
        .system(size: Size.title3, weight: .semibold, design: .default)
    }

    static var headline: Font {
        .system(size: Size.headline, weight: .semibold, design: .default)
    }

    static var body: Font {
        .system(size: Size.body, weight: .regular, design: .default)
    }

    static var callout: Font {
        .system(size: Size.callout, weight: .regular, design: .default)
    }

    static var subheadline: Font {
        .system(size: Size.subheadline, weight: .regular, design: .default)
    }

    static var footnote: Font {
        .system(size: Size.footnote, weight: .regular, design: .default)
    }

    static var caption1: Font {
        .system(size: Size.caption1, weight: .regular, design: .default)
    }

    static var caption2: Font {
        .system(size: Size.caption2, weight: .regular, design: .default)
    }

    // MARK: - Monospace Fonts (for DID, hashes, etc.)
    static var monospace: Font {
        .system(size: Size.body, weight: .regular, design: .monospaced)
    }

    static var monospaceSmall: Font {
        .system(size: Size.caption1, weight: .regular, design: .monospaced)
    }

    // MARK: - Custom Font Loading
    /// Load custom font files (if added to project)
    static func loadCustomFonts() {
        // Register custom fonts if they exist in the bundle
        // Example: UIFont.registerFont(bundle: Bundle.main, fontName: "VitalCV-Regular", fontExtension: "ttf")
    }
}

/// Font extension for easy access
extension Font {
    static var vitalCVDisplay: Font { VitalCVFonts.display }
    static var vitalCVHero: Font { VitalCVFonts.hero }
    static var vitalCVTitle1: Font { VitalCVFonts.title1 }
    static var vitalCVTitle2: Font { VitalCVFonts.title2 }
    static var vitalCVTitle3: Font { VitalCVFonts.title3 }
    static var vitalCVHeadline: Font { VitalCVFonts.headline }
    static var vitalCVBody: Font { VitalCVFonts.body }
    static var vitalCVCallout: Font { VitalCVFonts.callout }
    static var vitalCVSubheadline: Font { VitalCVFonts.subheadline }
    static var vitalCVFootnote: Font { VitalCVFonts.footnote }
    static var vitalCVCaption1: Font { VitalCVFonts.caption1 }
    static var vitalCVCaption2: Font { VitalCVFonts.caption2 }
    static var vitalCVMonospace: Font { VitalCVFonts.monospace }
    static var vitalCVMonospaceSmall: Font { VitalCVFonts.monospaceSmall }
}

/// Typography view modifier
struct VitalCVTypography: ViewModifier {
    let style: Font
    let color: Color?

    func body(content: Content) -> some View {
        content
            .font(style)
            .foregroundColor(color)
    }
}

extension View {
    func vitalCVTypography(_ style: Font, color: Color? = nil) -> some View {
        modifier(VitalCVTypography(style: style, color: color))
    }
}

