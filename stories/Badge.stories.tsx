import type { Meta, StoryObj } from "@storybook/react"
import { Badge } from "@/components/ui/badge"

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: "Badge",
  },
}

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary",
  },
}

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Destructive",
  },
}

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline",
  },
}

export const CredentialStatuses: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="default" className="bg-success/20 text-success-foreground dark:text-success">
        Valid
      </Badge>
      <Badge variant="destructive">Revoked</Badge>
      <Badge variant="outline" className="bg-warning/20 text-warning-foreground dark:text-warning border-warning/30">
        Expired
      </Badge>
      <Badge variant="secondary" className="bg-info/20 text-info-foreground dark:text-info">
        Unknown
      </Badge>
    </div>
  ),
}

export const WithCount: Story = {
  render: () => (
    <div className="flex gap-2">
      <div className="relative">
        <span>Notifications</span>
        <Badge className="ml-2" variant="default">
          3
        </Badge>
      </div>
      <div className="relative">
        <span>Messages</span>
        <Badge className="ml-2" variant="destructive">
          12
        </Badge>
      </div>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex gap-2 items-center">
      <Badge className="text-xs px-2 py-0.5">Small</Badge>
      <Badge>Medium</Badge>
      <Badge className="text-base px-3 py-1">Large</Badge>
    </div>
  ),
}
