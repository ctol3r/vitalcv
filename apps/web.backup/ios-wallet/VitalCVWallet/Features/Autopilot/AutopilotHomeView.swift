//
//  AutopilotHomeView.swift
//  VitalCVWallet
//
//  Main autopilot home view with toggle and conditional content
//

import SwiftUI

struct AutopilotHomeView: View {
    @AppStorage("autopilot_enabled") var autopilot: Bool = true
    @EnvironmentObject var lumen: LumenContext
    @StateObject private var autopilotEngine = AutopilotEngine()

    var body: some View {
        ZStack {
            ComplianceSkyOverlay()
            SkillGalaxyBackground()

            VStack(spacing: 28) {

                AutopilotToggleBar()

                if autopilot {
                    AutopilotStatusCard()
                        .padding(.top, 24)
                        .onAppear {
                            autopilotEngine.lumenContext = lumen
                            autopilotEngine.start()
                        }
                        .onDisappear {
                            autopilotEngine.stop()
                        }
                } else {
                    ManualModeActions()
                        .padding(.top, 24)
                }

                Spacer()
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct AutopilotHomeView_Previews: PreviewProvider {
    static var previews: some View {
        AutopilotHomeView()
            .environmentObject(LumenContext())
    }
}

