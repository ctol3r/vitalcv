import { validateCredentialId, validateEmail, validateLicenseNumber } from "@/lib/validation"

describe("Validation Utils", () => {
  describe("validateCredentialId", () => {
    it("validates correct credential ID format", () => {
      expect(validateCredentialId("CRED-12345")).toBe(true)
      expect(validateCredentialId("CRED-ABC123")).toBe(true)
    })

    it("rejects invalid credential ID format", () => {
      expect(validateCredentialId("")).toBe(false)
      expect(validateCredentialId("12345")).toBe(false)
      expect(validateCredentialId("INVALID")).toBe(false)
    })
  })

  describe("validateEmail", () => {
    it("validates correct email format", () => {
      expect(validateEmail("test@example.com")).toBe(true)
      expect(validateEmail("user.name@domain.co.uk")).toBe(true)
    })

    it("rejects invalid email format", () => {
      expect(validateEmail("")).toBe(false)
      expect(validateEmail("invalid-email")).toBe(false)
      expect(validateEmail("@domain.com")).toBe(false)
    })
  })

  describe("validateLicenseNumber", () => {
    it("validates correct license number format", () => {
      expect(validateLicenseNumber("LIC-12345")).toBe(true)
      expect(validateLicenseNumber("MD-67890")).toBe(true)
    })

    it("rejects invalid license number format", () => {
      expect(validateLicenseNumber("")).toBe(false)
      expect(validateLicenseNumber("12345")).toBe(false)
      expect(validateLicenseNumber("INVALID")).toBe(false)
    })
  })
})
