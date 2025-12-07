import { RevocationTimeline } from '@/components/RevocationTimeline';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

const meta: Meta<typeof RevocationTimeline> = {
  title: 'Components/RevocationTimeline',
  component: RevocationTimeline,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays a timeline of credential events including issuance, verification, and revocation.',
      },
    },
  },
  argTypes: {
    credentialId: {
      description: 'Unique credential identifier',
      control: 'text',
    },
    isOpen: {
      description: 'Whether the timeline is expanded',
      control: 'boolean',
    },
    onToggle: {
      description: 'Callback function for toggling timeline visibility',
      action: 'toggle',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Timeline closed
export const Closed: Story = {
  args: {
    credentialId: 'CRED-12345',
    isOpen: false,
    onToggle: () => {},
  },
};

// Timeline open with events
export const Open: Story = {
  args: {
    credentialId: 'CRED-12345',
    isOpen: true,
    onToggle: () => {},
  },
};

// Interactive timeline with state management
export const Interactive: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    return <RevocationTimeline {...args} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />;
  },
  args: {
    credentialId: 'CRED-12345',
  },
};

// Timeline with different credential IDs
export const DifferentCredential: Story = {
  args: {
    credentialId: 'CRED-67890',
    isOpen: true,
    onToggle: () => {},
  },
};

// Timeline with very long credential ID
export const LongCredentialId: Story = {
  args: {
    credentialId: 'CRED-very-long-credential-id-with-many-characters-123456789',
    isOpen: true,
    onToggle: () => {},
  },
};

// Multiple timelines comparison
export const MultipleTimelines: Story = {
  render: () => {
    const [timeline1, setTimeline1] = useState(false);
    const [timeline2, setTimeline2] = useState(true);
    const [timeline3, setTimeline3] = useState(false);

    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h3 className="text-lg font-semibold mb-4">Timeline 1 - Closed</h3>
          <RevocationTimeline
            credentialId="CRED-12345"
            isOpen={timeline1}
            onToggle={() => setTimeline1(!timeline1)}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Timeline 2 - Open</h3>
          <RevocationTimeline
            credentialId="CRED-67890"
            isOpen={timeline2}
            onToggle={() => setTimeline2(!timeline2)}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Timeline 3 - Closed</h3>
          <RevocationTimeline
            credentialId="CRED-99999"
            isOpen={timeline3}
            onToggle={() => setTimeline3(!timeline3)}
          />
        </div>
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
};

