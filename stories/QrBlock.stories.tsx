import type { Meta, StoryObj } from '@storybook/react'
import { QrBlock } from '@/components/credentials/QrBlock'

const meta: Meta<typeof QrBlock> = {
  title: 'Credentials/QrBlock',
  component: QrBlock,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'range', min: 128, max: 512, step: 64 },
    },
    loading: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof QrBlock>

export const Default: Story = {
  args: {
    data: 'openid-credential-offer://?credential_offer=eyJjcmVkZW50aWFsX2lzc3VlciI6Imh0dHBzOi8vdml0YWxjdi5jb20vaXNzdWVyIn0',
    title: 'Scan QR Code',
    description: 'Scan this code with your wallet app to receive the credential',
    size: 256,
  },
}

export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true,
  },
}

export const CustomTitle: Story = {
  args: {
    ...Default.args,
    title: 'Medical License Offer',
    description: 'Scan to claim your verified medical license credential',
  },
}

export const LargeQR: Story = {
  args: {
    ...Default.args,
    size: 384,
  },
}

export const SmallQR: Story = {
  args: {
    ...Default.args,
    size: 192,
  },
}
