//
//  SegmentFilterView.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 7
//  Pinned segment filter (All / Active / Expiring / Revoked)
//

import SwiftUI

struct SegmentFilterView: View {
    @Binding var selectedFilter: WalletHomeViewModel.CredentialFilter
    let filters: [WalletHomeViewModel.CredentialFilter]

    init(
        selectedFilter: Binding<WalletHomeViewModel.CredentialFilter>,
        filters: [WalletHomeViewModel.CredentialFilter] = WalletHomeViewModel.CredentialFilter.allCases
    ) {
        self._selectedFilter = selectedFilter
        self.filters = filters
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(filters, id: \.id) { filter in
                Button(action: {
                    withAnimation(.spring(response: 0.3)) {
                        selectedFilter = filter
                    }
                    HapticFeedbackService.shared.selectionChanged()
                }) {
                    Text(filter.rawValue)
                        .font(WalletTypography.subheadline)
                        .foregroundColor(selectedFilter == filter ? .white : .walletText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, WalletSpacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                                .fill(selectedFilter == filter ? Color.walletPrimary : Color.clear)
                        )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: WalletCornerRadius.medium)
                .fill(Color.walletCard)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

