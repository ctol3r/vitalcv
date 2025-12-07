//
//  LumenSwipeableCard.swift
//  VitalCVWallet
//
//  Swipeable card component for manual mode actions
//

import SwiftUI

enum SwipeActionStyle {
    case verify
    case renew
    case custom(color: Color)
}

struct SwipeAction {
    var style: SwipeActionStyle
    var title: String
    var color: Color
    var action: () -> Void

    init(style: SwipeActionStyle, title: String, color: Color, action: @escaping () -> Void) {
        self.style = style
        self.title = title
        self.color = color
        self.action = action
    }
}

struct LumenSwipeableCard<Content: View>: View {
    var actions: [SwipeAction]
    @ViewBuilder var content: () -> Content

    @State private var dragOffset: CGFloat = 0
    @State private var currentActionIndex: Int? = nil

    private let actionWidth: CGFloat = 80

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .trailing) {
                // Swipe actions background
                if let index = currentActionIndex, index < actions.count {
                    HStack(spacing: 0) {
                        ForEach(Array(actions.enumerated()), id: \.offset) { actionIndex, action in
                            Button(action: {
                                action.action()
                                withAnimation {
                                    dragOffset = 0
                                    currentActionIndex = nil
                                }
                            }) {
                                Text(action.title)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(.white)
                                    .frame(width: actionWidth)
                                    .frame(maxHeight: .infinity)
                                    .background(action.color)
                            }
                        }
                    }
                    .opacity(abs(dragOffset) / actionWidth)
                }

                // Main card content
                content()
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(12)
                    .offset(x: dragOffset)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                let translation = value.translation.width
                                if translation < 0 {
                                    dragOffset = translation
                                    let actionCount = actions.count
                                    if abs(translation) > actionWidth {
                                        let index = min(Int(abs(translation) / actionWidth), actionCount - 1)
                                        currentActionIndex = index
                                    } else {
                                        currentActionIndex = 0
                                    }
                                }
                            }
                            .onEnded { value in
                                if abs(dragOffset) > actionWidth / 2 {
                                    // Trigger first action if swiped far enough
                                    if let firstAction = actions.first {
                                        firstAction.action()
                                    }
                                }
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                    dragOffset = 0
                                    currentActionIndex = nil
                                }
                            }
                    )
            }
        }
        .frame(height: 80)
    }
}

struct LumenSwipeableCard_Previews: PreviewProvider {
    static var previews: some View {
        LumenSwipeableCard(
            actions: [
                .init(style: .verify, title: "Verify", color: .green) {
                    print("Verify tapped")
                },
                .init(style: .renew, title: "Renew", color: .orange) {
                    print("Renew tapped")
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
        .padding()
        .background(Color.black)
        .preferredColorScheme(.dark)
    }
}






