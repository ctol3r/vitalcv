//
//  PhysicsBasedScrollView.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 32
//  Physics-based scrolling (UIKit bridging)
//

import SwiftUI
import UIKit

struct PhysicsBasedScrollView<Content: View>: UIViewRepresentable {
    let content: Content
    let axis: Axis.Set
    let showsIndicators: Bool

    init(_ axis: Axis.Set = .vertical, showsIndicators: Bool = true, @ViewBuilder content: () -> Content) {
        self.axis = axis
        self.showsIndicators = showsIndicators
        self.content = content()
    }

    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.showsVerticalScrollIndicator = showsIndicators
        scrollView.showsHorizontalScrollIndicator = showsIndicators

        // Enable physics-based scrolling
        scrollView.decelerationRate = .normal
        scrollView.bounces = true
        scrollView.alwaysBounceVertical = axis == .vertical
        scrollView.alwaysBounceHorizontal = axis == .horizontal

        // Smooth scrolling
        scrollView.isPagingEnabled = false

        let hostingController = UIHostingController(rootView: content)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        scrollView.addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            hostingController.view.topAnchor.constraint(equalTo: scrollView.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            hostingController.view.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            hostingController.view.heightAnchor.constraint(equalTo: scrollView.heightAnchor)
        ])

        context.coordinator.hostingController = hostingController

        return scrollView
    }

    func updateUIView(_ uiView: UIScrollView, context: Context) {
        // Update if needed
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator {
        var hostingController: UIHostingController<Content>?
    }
}








