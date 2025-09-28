import type React from "react"
import { render, type RenderOptions } from "@testing-library/react"
import { Toaster } from "@/components/ui/toaster"

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from "@testing-library/react"

// Override render method
export { customRender as render }

// Common test data
export const mockCredentialResults = {
  valid: {
    status: "valid" as const,
    credentialId: "CRED-12345",
    auditRef: "AUDIT-789",
    details: {
      issuer: "California Medical Board",
      issuedDate: "2023-01-15",
      expiryDate: "2025-01-15",
      disclosureType: "Selective disclosure",
    },
  },
  revoked: {
    status: "revoked" as const,
    credentialId: "CRED-REVOKED",
    details: {
      issuer: "Texas Medical Board",
      issuedDate: "2022-06-01",
      reason: "License suspended due to administrative review",
    },
  },
  unknown: {
    status: "unknown" as const,
    credentialId: "CRED-UNKNOWN",
  },
}

export const mockFiles = {
  pdf: new File(["PDF content"], "test.pdf", { type: "application/pdf" }),
  doc: new File(["DOC content"], "test.doc", { type: "application/msword" }),
  docx: new File(["DOCX content"], "test.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  image: new File(["Image content"], "test.jpg", { type: "image/jpeg" }),
  large: new File(["Large file content"], "large.pdf", { type: "application/pdf" }),
}

// Increase file size for large file mock
Object.defineProperty(mockFiles.large, "size", { value: 15 * 1024 * 1024 }) // 15MB

// Helper functions for common test scenarios
export const waitForLoadingToFinish = () => new Promise((resolve) => setTimeout(resolve, 100))

export const mockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
})

export const mockApiError = (message = "API Error", status = 500) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ error: message }),
})
