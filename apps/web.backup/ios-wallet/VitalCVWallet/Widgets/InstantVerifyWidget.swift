//
//  InstantVerifyWidget.swift
//  VitalCVWallet
//
//  Created: Batch 557 - Task 25
//  iOS widget for "Instant Verify" shortcut
//

import WidgetKit
import SwiftUI

/// InstantVerifyWidget - iOS widget for instant verification
struct InstantVerifyWidget: Widget {
    let kind: String = "InstantVerifyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: InstantVerifyProvider()) { entry in
            InstantVerifyWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Instant Verify")
        .description("Quick access to verify credentials")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Provider

struct InstantVerifyProvider: TimelineProvider {
    func placeholder(in context: Context) -> InstantVerifyEntry {
        InstantVerifyEntry(date: Date(), credentialCount: 3)
    }

    func getSnapshot(in context: Context, completion: @escaping (InstantVerifyEntry) -> Void) {
        let entry = InstantVerifyEntry(date: Date(), credentialCount: WalletStatePersistence.shared.credentials.count)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<InstantVerifyEntry>) -> Void) {
        let currentDate = Date()
        let entry = InstantVerifyEntry(date: currentDate, credentialCount: WalletStatePersistence.shared.credentials.count)

        // Update every hour
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Entry

struct InstantVerifyEntry: TimelineEntry {
    let date: Date
    let credentialCount: Int
}

// MARK: - Entry View

struct InstantVerifyWidgetEntryView: View {
    var entry: InstantVerifyProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            smallWidgetView
        case .systemMedium:
            mediumWidgetView
        default:
            smallWidgetView
        }
    }

    private var smallWidgetView: some View {
        VStack(spacing: 8) {
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 32))
                .foregroundColor(.walletPrimary)

            Text("Verify")
                .font(.headline)
                .foregroundColor(.walletText)

            Text("\(entry.credentialCount) credentials")
                .font(.caption)
                .foregroundColor(.walletTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.walletBackground)
        .widgetURL(URL(string: "vitalcv://verify"))
    }

    private var mediumWidgetView: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 40))
                    .foregroundColor(.walletPrimary)

                Text("Instant Verify")
                    .font(.headline)
                    .foregroundColor(.walletText)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text("\(entry.credentialCount)")
                    .font(.title)
                    .foregroundColor(.walletPrimary)
                Text("credentials")
                    .font(.caption)
                    .foregroundColor(.walletTextSecondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.walletBackground)
        .widgetURL(URL(string: "vitalcv://verify"))
    }
}

// MARK: - Widget Bundle

@main
struct VitalCVWidgetBundle: WidgetBundle {
    var body: some Widget {
        InstantVerifyWidget()
    }
}

#Preview(as: .systemSmall) {
    InstantVerifyWidget()
} timeline: {
    InstantVerifyEntry(date: Date(), credentialCount: 3)
    InstantVerifyEntry(date: Date(), credentialCount: 5)
}

#Preview(as: .systemMedium) {
    InstantVerifyWidget()
} timeline: {
    InstantVerifyEntry(date: Date(), credentialCount: 3)
    InstantVerifyEntry(date: Date(), credentialCount: 5)
}

