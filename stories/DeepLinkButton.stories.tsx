import type { Meta, StoryObj } from '@storybook/react'
import { DeepLinkButton } from '@/components/credentials/DeepLinkButton'

const meta: Meta<typeof DeepLinkButton> = {
  title: 'Credentials/DeepLinkButton',
  component: DeepLinkButton,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DeepLinkButton>

export const Default: Story = {
  args: {
    deepLink: 'vitalcv-wallet://credential-offer?offer=eyJjcmVkZW50aWFsX2lzc3VlciI6Imh0dHBzOi8vdml0YWxjdi5jb20vaXNzdWVyIn0',
    offerUrl: 'openid-credential-offer://?credential_offer=eyJjcmVkZW50aWFsX2lzc3VlciI6Imh0dHBzOi8vdml0YWxjdi5jb20vaXNzdWVyIn0',
    label: 'Open in Wallet',
    description: 'Use these links to open the offer in your mobile wallet or copy for later',
  },
}

export const CustomLabel: Story = {
  args: {
    ...Default.args,
    label: 'Claim Credential',
    description: 'Share this link securely with the credential holder',
  },
}
