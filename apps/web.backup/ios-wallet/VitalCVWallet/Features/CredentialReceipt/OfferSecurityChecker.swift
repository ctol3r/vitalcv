//
//  OfferSecurityChecker.swift
//  VitalCVWallet
//
//  Created: Phase 1 - Task 7
//  Security validation for credential offers
//

import Foundation

/// Security checker for credential offers
@MainActor
class OfferSecurityChecker {
    static let shared = OfferSecurityChecker()

    private let trustedDomains: Set<String> = [
        "vitalcv.com",
        "sutterhealth.org",
        "stanfordhealth.org",
        "ucsf.edu",
        "npi.gov",
        "deahq.gov",
        "fsmb.org",
        "abms.org"
    ]

    private let untrustedDomains: Set<String> = [
        // Known bad actors can be added here
    ]

    private init() {}

    /// Perform security check on offer (Phase 1 - Task 7)
    func checkOffer(_ offer: EnhancedCredentialOffer, metadata: CredentialOfferMetadata?) async -> OfferSecurityCheck {
        var issues: [String] = []
        var issuerDomain: String?
        var redirectDomain: String?
        var trustTier: TrustTier = .unknown

        // Extract issuer domain
        if let issuerURL = URL(string: offer.issuer) {
            issuerDomain = issuerURL.host
        } else {
            // Try to extract domain from issuer string
            issuerDomain = extractDomain(from: offer.issuer)
        }

        // Check redirect URI domain
        if let redirectURI = offer.authorizationServer?.absoluteString {
            if let redirectURL = URL(string: redirectURI) {
                redirectDomain = redirectURL.host
            }
        }

        // Validate issuer domain
        if let domain = issuerDomain {
            if untrustedDomains.contains(domain) {
                trustTier = .untrusted
                issues.append("Issuer domain is in untrusted list: \(domain)")
            } else if trustedDomains.contains(domain) {
                trustTier = .trusted
            } else {
                // Check if domain is valid format
                if !isValidDomain(domain) {
                    issues.append("Invalid issuer domain format: \(domain)")
                    trustTier = .untrusted
                } else {
                    trustTier = .verified
                }
            }
        } else {
            issues.append("Could not extract issuer domain")
            trustTier = .unknown
        }

        // Validate redirect URI matches issuer domain
        if let issuerDomain = issuerDomain,
           let redirectDomain = redirectDomain {
            if !domainsMatch(issuerDomain, redirectDomain) {
                issues.append("Redirect URI domain (\(redirectDomain)) does not match issuer domain (\(issuerDomain))")
            }
        }

        // Validate metadata URL matches issuer
        if let metadataURL = URL(string: offer.metadataURL.absoluteString),
           let metadataDomain = metadataURL.host,
           let issuerDomain = issuerDomain {
            if !domainsMatch(issuerDomain, metadataDomain) {
                issues.append("Metadata URL domain (\(metadataDomain)) does not match issuer domain (\(issuerDomain))")
            }
        }

        // Check for suspicious patterns
        if let issuer = issuerDomain {
            if issuer.contains("localhost") || issuer.contains("127.0.0.1") {
                issues.append("Issuer uses localhost - not safe for production")
            }

            if issuer.hasPrefix("http://") && !issuer.contains("localhost") {
                issues.append("Issuer uses insecure HTTP protocol")
            }
        }

        let isSafe = issues.isEmpty && trustTier != .untrusted

        return OfferSecurityCheck(
            isSafe: isSafe,
            issuerDomain: issuerDomain,
            redirectDomain: redirectDomain,
            trustTier: trustTier,
            issues: issues
        )
    }

    // MARK: - Private Helpers

    private func extractDomain(from string: String) -> String? {
        // Try to extract domain from various formats
        if let url = URL(string: string) {
            return url.host
        }

        // Try DID format: did:web:example.com:path
        if string.hasPrefix("did:web:") {
            let parts = string.dropFirst(8).split(separator: ":")
            return parts.first.map(String.init)
        }

        // Try to find domain-like pattern
        let pattern = #"([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}"#
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: string, range: NSRange(string.startIndex..., in: string)),
           let range = Range(match.range, in: string) {
            return String(string[range])
        }

        return nil
    }

    private func isValidDomain(_ domain: String) -> Bool {
        // Basic domain validation
        let pattern = #"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"#
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(domain.startIndex..., in: domain)
        return regex?.firstMatch(in: domain, range: range) != nil
    }

    private func domainsMatch(_ domain1: String, _ domain2: String) -> Bool {
        // Normalize domains (remove www, etc.)
        let normalized1 = normalizeDomain(domain1)
        let normalized2 = normalizeDomain(domain2)

        // Exact match
        if normalized1 == normalized2 {
            return true
        }

        // Check if one is subdomain of the other
        if normalized1.hasSuffix("." + normalized2) || normalized2.hasSuffix("." + normalized1) {
            return true
        }

        return false
    }

    private func normalizeDomain(_ domain: String) -> String {
        var normalized = domain.lowercased()

        // Remove www prefix
        if normalized.hasPrefix("www.") {
            normalized = String(normalized.dropFirst(4))
        }

        return normalized
    }
}

