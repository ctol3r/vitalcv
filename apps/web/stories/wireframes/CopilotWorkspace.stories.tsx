import type { Meta, StoryObj } from '@storybook/react';
import { CopilotWorkspace } from '../../components/copilot/CopilotWorkspace';

const meta = {
  title: 'Wireframes/CopilotWorkspace',
  component: CopilotWorkspace,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CopilotWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
