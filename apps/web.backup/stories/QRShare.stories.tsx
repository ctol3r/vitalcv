import { QRShare } from '@/components/QRShare';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof QRShare> = {
  title: 'Components/QRShare',
  component: QRShare,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'QR code sharing component with static QR generation and clipboard copy functionality.',
      },
    },
  },
  argTypes: {
    credentialId: {
      description: 'Credential ID to share',
      control: 'text',
    },
    status: {
      description: 'Verification status',
      control: { type: 'select' },
      options: ['valid', 'revoked', 'unknown'],
      mapping: {
        valid: 'valid',
        revoked: 'revoked',
        unknown: 'unknown',
      },
    },
    details: {
      description: 'Additional credential details',
      control: 'object',
    },
    'details.issuer': {
      description: 'Credential issuer name',
      control: 'text',
    },
    'details.issuedDate': {
      description: 'Date when credential was issued',
      control: 'date',
    },
    'details.expiryDate': {
      description: 'Date when credential expires',
      control: 'date',
    },
    'details.reason': {
      description: 'Reason for revocation (if applicable)',
      control: 'text',
    },
    'details.disclosureType': {
      description: 'Type of disclosure',
      control: { type: 'select' },
      options: ['Full disclosure', 'Partial disclosure', 'Minimal disclosure'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Valid credential QR share
export const ValidCredential: Story = {
  args: {
    credentialId: 'CRED-12345',
    status: 'valid',
    details: {
      issuer: 'California Medical Board',
      issuedDate: '2023-01-15',
      expiryDate: '2025-01-15',
    },
  },
};

// Revoked credential QR share
export const RevokedCredential: Story = {
  args: {
    credentialId: 'CRED-67890',
    status: 'revoked',
    details: {
      issuer: 'Texas Medical Board',
      issuedDate: '2022-06-01',
      expiryDate: '2024-06-01',
      reason: 'License suspended',
    },
  },
};

// Unknown credential QR share
export const UnknownCredential: Story = {
  args: {
    credentialId: 'CRED-99999',
    status: 'unknown',
    details: {},
  },
};

// Long credential ID
export const LongCredentialId: Story = {
  args: {
    credentialId: 'CRED-very-long-credential-id-with-many-characters-123456789',
    status: 'valid',
    details: {
      issuer: 'Very Long Institution Name That Might Wrap',
      issuedDate: '2023-01-15',
      expiryDate: '2025-01-15',
    },
  },
};

// Minimal details
export const MinimalDetails: Story = {
  args: {
    credentialId: 'CRED-12345',
    status: 'valid',
    details: {},
  },
};

// All states comparison
export const AllStates: Story = {
  render: () => (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold mb-4">Valid Credential</h3>
        <QRShare
          credentialId="CRED-12345"
          status="valid"
          details={{
            issuer: 'California Medical Board',
            issuedDate: '2023-01-15',
            expiryDate: '2025-01-15',
          }}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Revoked Credential</h3>
        <QRShare
          credentialId="CRED-67890"
          status="revoked"
          details={{
            issuer: 'Texas Medical Board',
            issuedDate: '2022-06-01',
            expiryDate: '2024-06-01',
            reason: 'License suspended',
          }}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Unknown Credential</h3>
        <QRShare credentialId="CRED-99999" status="unknown" details={{}} />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
