import { VerifyResult } from '@/components/VerifyResult';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

const meta: Meta<typeof VerifyResult> = {
  title: 'Components/VerifyResult',
  component: VerifyResult,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays verification results with status, details, and interactive actions.',
      },
    },
  },
  argTypes: {
    result: {
      description: 'Verification result data',
      control: 'object',
    },
    'result.status': {
      description: 'Credential verification status',
      control: { type: 'select' },
      options: ['valid', 'revoked', 'unknown'],
      mapping: {
        valid: 'valid',
        revoked: 'revoked',
        unknown: 'unknown',
      },
    },
    'result.credentialId': {
      description: 'Unique credential identifier',
      control: 'text',
    },
    'result.auditRef': {
      description: 'Audit reference for tracking',
      control: 'text',
    },
    'result.timestamp': {
      description: 'Verification timestamp',
      control: 'date',
    },
    'result.details.issuer': {
      description: 'Credential issuer name',
      control: 'text',
    },
    'result.details.issuedDate': {
      description: 'Date when credential was issued',
      control: 'date',
    },
    'result.details.expiryDate': {
      description: 'Date when credential expires',
      control: 'date',
    },
    'result.details.reason': {
      description: 'Reason for revocation (if applicable)',
      control: 'text',
    },
    'result.details.disclosureType': {
      description: 'Type of disclosure',
      control: { type: 'select' },
      options: ['Full disclosure', 'Partial disclosure', 'Minimal disclosure'],
    },
    onRecheck: {
      description: 'Callback function for rechecking credential',
      action: 'recheck',
    },
    isRechecking: {
      description: 'Whether a recheck is currently in progress',
      control: 'boolean',
    },
    lastCheckTime: {
      description: 'Timestamp of last verification check',
      control: 'date',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Valid credential story
export const ValidCredential: Story = {
  args: {
    result: {
      status: 'valid',
      credentialId: 'CRED-12345',
      auditRef: 'AUDIT-001',
      timestamp: new Date().toISOString(),
      details: {
        issuer: 'California Medical Board',
        issuedDate: '2023-01-15',
        expiryDate: '2025-01-15',
        disclosureType: 'Full disclosure',
      },
    },
    isRechecking: false,
    lastCheckTime: new Date(),
  },
};

// Revoked credential story
export const RevokedCredential: Story = {
  args: {
    result: {
      status: 'revoked',
      credentialId: 'CRED-67890',
      auditRef: 'AUDIT-002',
      timestamp: new Date().toISOString(),
      details: {
        issuer: 'Texas Medical Board',
        issuedDate: '2022-06-01',
        expiryDate: '2024-06-01',
        reason: 'License suspended due to disciplinary action',
        disclosureType: 'Full disclosure',
      },
    },
    isRechecking: false,
    lastCheckTime: new Date(),
  },
};

// Unknown credential story
export const UnknownCredential: Story = {
  args: {
    result: {
      status: 'unknown',
      credentialId: 'CRED-99999',
      auditRef: 'AUDIT-003',
      timestamp: new Date().toISOString(),
      details: {
        disclosureType: 'Full disclosure',
      },
    },
    isRechecking: false,
    lastCheckTime: new Date(),
  },
};

// Rechecking state story
export const Rechecking: Story = {
  args: {
    result: {
      status: 'valid',
      credentialId: 'CRED-12345',
      auditRef: 'AUDIT-001',
      timestamp: new Date().toISOString(),
      details: {
        issuer: 'California Medical Board',
        issuedDate: '2023-01-15',
        expiryDate: '2025-01-15',
        disclosureType: 'Full disclosure',
      },
    },
    isRechecking: true,
    lastCheckTime: new Date(Date.now() - 30000), // 30 seconds ago
  },
};

// Interactive story with state management
export const Interactive: Story = {
  render: (args) => {
    const [isRechecking, setIsRechecking] = useState(false);
    const [lastCheckTime, setLastCheckTime] = useState<Date | null>(new Date());

    const handleRecheck = () => {
      setIsRechecking(true);
      setTimeout(() => {
        setIsRechecking(false);
        setLastCheckTime(new Date());
      }, 2000);
    };

    return (
      <VerifyResult
        {...args}
        isRechecking={isRechecking}
        lastCheckTime={lastCheckTime}
        onRecheck={handleRecheck}
      />
    );
  },
  args: {
    result: {
      status: 'valid',
      credentialId: 'CRED-12345',
      auditRef: 'AUDIT-001',
      timestamp: new Date().toISOString(),
      details: {
        issuer: 'California Medical Board',
        issuedDate: '2023-01-15',
        expiryDate: '2025-01-15',
        disclosureType: 'Full disclosure',
      },
    },
  },
};

// All states comparison
export const AllStates: Story = {
  render: () => (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold mb-4">Valid Credential</h3>
        <VerifyResult
          result={{
            status: 'valid',
            credentialId: 'CRED-12345',
            auditRef: 'AUDIT-001',
            timestamp: new Date().toISOString(),
            details: {
              issuer: 'California Medical Board',
              issuedDate: '2023-01-15',
              expiryDate: '2025-01-15',
              disclosureType: 'Full disclosure',
            },
          }}
          onRecheck={() => {}}
          isRechecking={false}
          lastCheckTime={new Date()}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Revoked Credential</h3>
        <VerifyResult
          result={{
            status: 'revoked',
            credentialId: 'CRED-67890',
            auditRef: 'AUDIT-002',
            timestamp: new Date().toISOString(),
            details: {
              issuer: 'Texas Medical Board',
              issuedDate: '2022-06-01',
              expiryDate: '2024-06-01',
              reason: 'License suspended due to disciplinary action',
              disclosureType: 'Full disclosure',
            },
          }}
          onRecheck={() => {}}
          isRechecking={false}
          lastCheckTime={new Date()}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Unknown Credential</h3>
        <VerifyResult
          result={{
            status: 'unknown',
            credentialId: 'CRED-99999',
            auditRef: 'AUDIT-003',
            timestamp: new Date().toISOString(),
            details: {
              disclosureType: 'Full disclosure',
            },
          }}
          onRecheck={() => {}}
          isRechecking={false}
          lastCheckTime={new Date()}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
