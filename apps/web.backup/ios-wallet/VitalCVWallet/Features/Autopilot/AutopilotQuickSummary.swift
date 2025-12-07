//
//  AutopilotQuickSummary.swift
//  VitalCVWallet
//
//  Quick summary rows for autopilot status
//

import SwiftUI

struct AutopilotQuickSummary: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            summaryRow("Credentials Verified")
            summaryRow("Telemedicine Ready")
            summaryRow("CME Status OK")
            summaryRow("DEA Active")
            summaryRow("Licenses Synced")
        }
    }

    func summaryRow(_ title: String) -> some View {
        HStack {
            Circle()
                .fill(Color.green.opacity(0.9))
                .frame(width: 10, height: 10)
            Text(title)
                .font(.footnote)
                .foregroundColor(.white.opacity(0.85))
            Spacer()
        }
    }
}

struct AutopilotQuickSummary_Previews: PreviewProvider {
    static var previews: some View {
        AutopilotQuickSummary()
            .padding()
            .background(Color.black.opacity(0.5))
            .cornerRadius(24)
            .preferredColorScheme(.dark)
    }
}






