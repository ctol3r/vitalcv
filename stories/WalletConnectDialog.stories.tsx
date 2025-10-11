import type { Meta, StoryObj } from '@storybook/react'
import { WalletConnectDialog } from '@/components/wallet/WalletConnectDialog'
import { fn } from '@storybook/test'

const meta: Meta<typeof WalletConnectDialog> = {
  title: 'Wallet/WalletConnectDialog',
  component: WalletConnectDialog,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof WalletConnectDialog>

export const Disconnected: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    onConnect: fn(),
    state: 'disconnected',
  },
}

export const Connecting: Story = {
  args: {
    ...Disconnected.args,
    state: 'connecting',
  },
}

export const Connected: Story = {
  args: {
    ...Disconnected.args,
    state: 'connected',
    connectedAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  },
}

export const Signing: Story = {
  args: {
    ...Disconnected.args,
    state: 'signing',
    connectedAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  },
}

export const Error: Story = {
  args: {
    ...Disconnected.args,
    state: 'error',
    error: 'Failed to connect to MetaMask. Please ensure it is installed and unlocked.',
  },
}
