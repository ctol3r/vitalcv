/**
 * Validation utilities for VitalCV frontend
 */

export function validateCredentialId(credentialId: string): boolean {
  if (!credentialId || credentialId.trim() === "") {
    return false
  }

  // Credential ID should follow pattern: CRED-XXXXX or similar prefix-suffix format
  const credentialPattern = /^[A-Z]{2,}-[A-Z0-9]{3,}$/i
  return credentialPattern.test(credentialId.trim())
}

export function validateEmail(email: string): boolean {
  if (!email || email.trim() === "") {
    return false
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(email.trim())
}

export function validateLicenseNumber(licenseNumber: string): boolean {
  if (!licenseNumber || licenseNumber.trim() === "") {
    return false
  }

  // License number should follow pattern: LIC-XXXXX, MD-XXXXX, etc.
  const licensePattern = /^[A-Z]{2,}-[A-Z0-9]{3,}$/i
  return licensePattern.test(licenseNumber.trim())
}

export function validateNonce(nonce: string): boolean {
  // Nonce is optional, but if provided should be non-empty
  return nonce.trim().length > 0
}

export function validateAudience(audience: string): boolean {
  // Audience is optional, but if provided should be non-empty
  return audience.trim().length > 0
}
