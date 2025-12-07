//
//  FinancialIdentityView.swift
//  VitalCVWallet
//
//  Created: Clinician Financial Identity Engine - Phase 1
//  Main view for financial identity management
//

import SwiftUI

struct FinancialIdentityView: View {
    @StateObject private var engine = FinancialIdentityEngine.shared
    @State private var showingCreateForm = false
    @State private var clinicianId: String = ""

    var body: some View {
        NavigationView {
            ZStack {
                if engine.isLoading {
                    ProgressView("Loading financial identity...")
                } else if let identity = engine.financialIdentity {
                    FinancialIdentityDetailView(identity: identity)
                } else {
                    VStack(spacing: 20) {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)

                        Text("No Financial Identity Found")
                            .font(.title2)
                            .fontWeight(.semibold)

                        Text("Create or link your financial identity to get started")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)

                        Button(action: {
                            showingCreateForm = true
                        }) {
                            Text("Create Financial Identity")
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(Color.blue)
                                .cornerRadius(10)
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .navigationTitle("Financial Identity")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        showingCreateForm = true
                    }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingCreateForm) {
                CreateFinancialIdentityView()
            }
            .alert("Error", isPresented: .constant(engine.error != nil), presenting: engine.error) { error in
                Button("OK") {
                    engine.error = nil
                }
            } message: { error in
                Text(error.localizedDescription)
            }
        }
    }
}

struct FinancialIdentityDetailView: View {
    let identity: FinancialIdentity
    @StateObject private var engine = FinancialIdentityEngine.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header Card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.blue)

                        VStack(alignment: .leading) {
                            Text("Financial Identity")
                                .font(.title2)
                                .fontWeight(.bold)

                            if let npi = identity.npi {
                                Text("NPI: \(npi)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()

                        if identity.onChainHash != nil {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundColor(.green)
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)

                // TIN/EIN Section
                if let tin = identity.tin {
                    InfoCard(title: "Tax ID", value: tin)
                }

                // Entity Type
                if let entityType = identity.entityType {
                    InfoCard(title: "Entity Type", value: entityType.replacingOccurrences(of: "_", with: " ").capitalized)
                }

                // Practice Addresses
                if let addresses = identity.practiceAddresses, !addresses.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Practice Addresses")
                            .font(.headline)

                        ForEach(addresses.indices, id: \.self) { index in
                            AddressCard(address: addresses[index])
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }

                // PECOS Metadata
                if let pecos = identity.pecosMetadata {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Medicare Reassignment (PECOS)")
                            .font(.headline)

                        if let pecosId = pecos.pecosId {
                            Text("PECOS ID: \(pecosId)")
                                .font(.subheadline)
                        }

                        if let allowed = pecos.reassignmentAllowed {
                            HStack {
                                Image(systemName: allowed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundColor(allowed ? .green : .red)
                                Text("Reassignment Allowed: \(allowed ? "Yes" : "No")")
                                    .font(.subheadline)
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }

                // Misalignments Warning
                if let misalignments = identity.misalignments,
                   (misalignments.npiTinMismatch || misalignments.addressMismatch) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text("Misalignments Detected")
                                .font(.headline)
                                .foregroundColor(.orange)
                        }

                        ForEach(misalignments.details, id: \.self) { detail in
                            Text("• \(detail)")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(12)
                }

                // Chain Anchor Status
                if let hash = identity.onChainHash {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "link")
                                .foregroundColor(.blue)
                            Text("Chain Anchor")
                                .font(.headline)
                        }

                        Text(hash)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }
            }
            .padding()
        }
    }
}

struct InfoCard: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
            Spacer()
            Text(value)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct AddressCard: View {
    let address: PracticeAddress

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(address.street)
            Text("\(address.city), \(address.state) \(address.zip)")
            if let country = address.country {
                Text(country)
            }
        }
        .font(.subheadline)
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

struct CreateFinancialIdentityView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var engine = FinancialIdentityEngine.shared

    @State private var clinicianId: String = ""
    @State private var npi: String = ""
    @State private var tin: String = ""
    @State private var entityType: String = "sole_prop"

    let entityTypes = ["sole_prop", "corporation", "pllc", "llc", "partnership"]

    var body: some View {
        NavigationView {
            Form {
                Section("Basic Information") {
                    TextField("Clinician ID", text: $clinicianId)
                    TextField("NPI (optional)", text: $npi)
                    TextField("TIN/EIN (optional)", text: $tin)

                    Picker("Entity Type", selection: $entityType) {
                        ForEach(entityTypes, id: \.self) { type in
                            Text(type.replacingOccurrences(of: "_", with: " ").capitalized)
                                .tag(type)
                        }
                    }
                }
            }
            .navigationTitle("Create Financial Identity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        Task {
                            do {
                                let data = FinancialIdentityData(
                                    clinicianId: clinicianId,
                                    npi: npi.isEmpty ? nil : npi,
                                    npiType2: nil,
                                    tin: tin.isEmpty ? nil : tin,
                                    ein: tin.isEmpty ? nil : tin,
                                    entityType: entityType,
                                    practiceAddresses: nil,
                                    w9Metadata: nil,
                                    linkedDid: nil,
                                    pecosMetadata: nil
                                )

                                _ = try await engine.createOrUpdateFinancialIdentity(data)
                                dismiss()
                            } catch {
                                print("Error creating financial identity: \(error)")
                            }
                        }
                    }
                    .disabled(clinicianId.isEmpty)
                }
            }
        }
    }
}

#Preview {
    FinancialIdentityView()
}

