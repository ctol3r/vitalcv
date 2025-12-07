//
//  MicroLoadingArcs.swift
//  VitalCVWallet
//
//  Created: Phase 5 - Task 39
//  Add micro-loading arcs around the credential icon
//

import SwiftUI

struct MicroLoadingArcs: View {
    @State private var rotation: Double = 0
    @State private var progress: Double = 0.0

    var body: some View {
        ZStack {
            // Outer arc
            Circle()
                .trim(from: 0, to: 0.3)
                .stroke(
                    AngularGradient(
                        colors: [Color.blue, Color.purple],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 3, lineCap: .round)
                )
                .frame(width: 60, height: 60)
                .rotationEffect(.degrees(rotation))

            // Middle arc
            Circle()
                .trim(from: 0, to: 0.4)
                .stroke(
                    AngularGradient(
                        colors: [Color.purple, Color.pink],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round)
                )
                .frame(width: 50, height: 50)
                .rotationEffect(.degrees(-rotation * 1.5))

            // Inner arc
            Circle()
                .trim(from: 0, to: 0.25)
                .stroke(
                    AngularGradient(
                        colors: [Color.pink, Color.blue],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round)
                )
                .frame(width: 40, height: 40)
                .rotationEffect(.degrees(rotation * 0.8))
        }
        .onAppear {
            withAnimation(
                Animation.linear(duration: 2.0)
                    .repeatForever(autoreverses: false)
            ) {
                rotation = 360
            }

            withAnimation(
                Animation.easeInOut(duration: 1.5)
                    .repeatForever(autoreverses: true)
            ) {
                progress = 1.0
            }
        }
    }
}

