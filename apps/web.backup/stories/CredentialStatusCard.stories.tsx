import type { Meta, StoryObj } from "@storybook/react"
import { CredentialStatusCard } from "@/components/CredentialStatusCard"

const meta: Meta<typeof CredentialStatusCard> = {
  title: "Components/CredentialStatusCard",
  component: CredentialStatusCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Valid: Story = {
  args: {
    result: {
      status: "valid",
      credentialId: "CRED-12345",
      auditRef: "AUDIT-789",
      details: {
        issuer: "California Medical Board",
        issuedDate: "2023-01-15",
        expiryDate: "2025-01-15",
        disclosureType: "Selective disclosure",
      },
    },
  },
}

export const Revoked: Story = {
  args: {
    result: {
      status: "revoked",
      credentialId: "CRED-REVOKED",
      details: {
        issuer: "Texas Medical Board",
        issuedDate: "2022-06-01",
        reason: "License suspended due to administrative review",
      },
    },
  },
}

export const Unknown: Story = {
  args: {
    result: {
      status: "unknown",
      credentialId: "CRED-UNKNOWN",
    },
  },
}

export const MinimalValid: Story = {
  args: {
    result: {
      status: "valid",
      credentialId: "CRED-MINIMAL",
    },
  },
}

export const WithLongReason: Story = {
  args: {
    result: {
      status: "revoked",
      credentialId: "CRED-LONG-REASON",
      details: {
        issuer: "Florida Medical Board",
        reason:
          "License revoked due to failure to complete continuing medical education requirements within the specified timeframe and failure to respond to board communications regarding compliance status.",
      },
    },
  },
}
