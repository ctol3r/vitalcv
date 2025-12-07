//
//  DocumentTypePredictor.swift
//  VitalCVWallet
//
//  Created: Medical Imaging Credential Extractor - Phase 1, Task 5
//  Document type prediction: license, DEA, CME, board cert, diploma
//

import Foundation
import UIKit

/// Types of medical credentials
enum CredentialDocumentType: String, Codable {
    case medicalLicense = "medical_license"
    case dea = "dea"
    case cme = "cme"
    case boardCertification = "board_certification"
    case diploma = "diploma"
    case unknown = "unknown"
}

/// Document type prediction result
struct DocumentTypePrediction {
    let type: CredentialDocumentType
    let confidence: Double
    let indicators: [TypeIndicator]
    let suggestedFields: [String]
}

/// Indicators that led to the type prediction
struct TypeIndicator: Identifiable {
    let id: String
    let text: String
    let weight: Double
    let location: String?
}

/// Document type predictor
@MainActor
class DocumentTypePredictor {

    // MARK: - Type Detection Keywords

    private let licenseKeywords = [
        "medical license", "physician license", "state board", "license number",
        "licensee", "licensed to practice", "expiration date", "renewal date",
        "board of medicine", "medical board"
    ]

    private let deaKeywords = [
        "dea", "drug enforcement administration", "dea number", "dea registration",
        "controlled substances", "schedule", "registration number", "dea certificate"
    ]

    private let cmeKeywords = [
        "continuing medical education", "cme", "cm credit", "credit hours",
        "ama pra category", "accredited provider", "certificate of completion",
        "educational activity"
    ]

    private let boardCertKeywords = [
        "board certified", "board certification", "american board", "certification",
        "diplomate", "certified by", "specialty board", "board of", "certificate"
    ]

    private let diplomaKeywords = [
        "diploma", "degree", "doctor of medicine", "m.d.", "doctor of osteopathy",
        "d.o.", "university", "college", "school of medicine", "graduation",
        "conferred", "degree granted"
    ]

    // MARK: - Prediction

    /// Predict document type from OCR text
    func predictType(from ocrText: String) -> DocumentTypePrediction {
        let normalizedText = ocrText.lowercased()

        var scores: [CredentialDocumentType: Double] = [
            .medicalLicense: 0.0,
            .dea: 0.0,
            .cme: 0.0,
            .boardCertification: 0.0,
            .diploma: 0.0
        ]

        var indicators: [TypeIndicator] = []

        // Score each type
        scores[.medicalLicense] = scoreKeywords(normalizedText, keywords: licenseKeywords, type: .medicalLicense, indicators: &indicators)
        scores[.dea] = scoreKeywords(normalizedText, keywords: deaKeywords, type: .dea, indicators: &indicators)
        scores[.cme] = scoreKeywords(normalizedText, keywords: cmeKeywords, type: .cme, indicators: &indicators)
        scores[.boardCertification] = scoreKeywords(normalizedText, keywords: boardCertKeywords, type: .boardCertification, indicators: &indicators)
        scores[.diploma] = scoreKeywords(normalizedText, keywords: diplomaKeywords, type: .diploma, indicators: &indicators)

        // Find highest scoring type
        let sortedTypes = scores.sorted { $0.value > $1.value }
        guard let topType = sortedTypes.first else {
            return DocumentTypePrediction(
                type: .unknown,
                confidence: 0.0,
                indicators: [],
                suggestedFields: []
            )
        }

        let predictedType = topType.key
        let confidence = min(topType.value, 1.0)

        // Filter indicators for predicted type
        let relevantIndicators = indicators.filter { indicator in
            indicator.id.contains(predictedType.rawValue)
        }

        // Get suggested fields for this type
        let suggestedFields = getSuggestedFields(for: predictedType)

        return DocumentTypePrediction(
            type: predictedType,
            confidence: confidence,
            indicators: relevantIndicators,
            suggestedFields: suggestedFields
        )
    }

    // MARK: - Private Helpers

    private func scoreKeywords(_ text: String, keywords: [String], type: CredentialDocumentType, indicators: inout [TypeIndicator]) -> Double {
        var score = 0.0
        var matches: [String] = []

        for keyword in keywords {
            let occurrences = text.components(separatedBy: keyword).count - 1
            if occurrences > 0 {
                let weight = 1.0 / Double(keywords.count) // Normalize by keyword count
                score += Double(occurrences) * weight
                matches.append(keyword)

                // Add indicator
                indicators.append(TypeIndicator(
                    id: "\(type.rawValue)-\(keyword)",
                    text: keyword,
                    weight: weight,
                    location: nil
                ))
            }
        }

        // Cap score at 1.0
        return min(score, 1.0)
    }

    private func getSuggestedFields(for type: CredentialDocumentType) -> [String] {
        switch type {
        case .medicalLicense:
            return ["name", "licenseNumber", "state", "issueDate", "expiryDate", "specialties"]
        case .dea:
            return ["deaNumber", "name", "issueDate", "expiryDate", "schedules", "address"]
        case .cme:
            return ["name", "provider", "credits", "completedDate", "activityTitle", "category"]
        case .boardCertification:
            return ["name", "specialty", "certifyingBody", "issueDate", "expiryDate", "certificateNumber"]
        case .diploma:
            return ["name", "degree", "institution", "graduationDate", "fieldOfStudy"]
        case .unknown:
            return []
        }
    }
}

