//
//  ManualModeActions.swift
//  VitalCVWallet
//
//  Manual mode actions view when autopilot is disabled
//

import SwiftUI

struct ManualModeActions: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Manual Mode")
                .font(.title.bold())
                .foregroundColor(.white)

            LumenSwipeableCard(
                actions: [
                    .init(style: .verify, title: "Verify", color: .green) {
                        // TODO: Implement verify action
                        print("Verify action triggered")
                    },
                    .init(style: .renew, title: "Renew", color: .orange) {
                        // TODO: Implement renew action
                        print("Renew action triggered")
                    }
                ]
            ) {
                VStack(alignment: .leading) {
                    Text("CA Physician License")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text("Expires in 32 days")
                        .foregroundColor(.white.opacity(0.7))
                        .font(.caption)
                }
                .padding()
            }
        }
        .padding(.horizontal, 24)
    }
}

struct ManualModeActions_Previews: PreviewProvider {
    static var previews: some View {
        ManualModeActions()
            .padding()
            .background(Color.black)
            .preferredColorScheme(.dark)
    }
}






