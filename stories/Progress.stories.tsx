import type { Meta, StoryObj } from "@storybook/react"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"

const meta: Meta<typeof Progress> = {
  title: "Components/Progress",
  component: Progress,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 60,
    className: "w-80",
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <div className="flex justify-between text-sm">
        <Label>Upload Progress</Label>
        <span className="text-muted-foreground">60%</span>
      </div>
      <Progress value={60} />
    </div>
  ),
}

export const CredentialVerification: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <div>
        <div className="flex justify-between text-sm mb-2">
          <Label>Verifying credentials...</Label>
          <span className="text-muted-foreground">3 of 5 complete</span>
        </div>
        <Progress value={60} />
      </div>
    </div>
  ),
}

export const MultipleSteps: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span>Step 1: Identity Verification</span>
          <span className="text-success">✓</span>
        </div>
        <Progress value={100} className="bg-success/20" />
      </div>
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span>Step 2: Document Upload</span>
          <span className="text-success">✓</span>
        </div>
        <Progress value={100} className="bg-success/20" />
      </div>
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span>Step 3: Credential Issuance</span>
          <span className="text-muted-foreground">75%</span>
        </div>
        <Progress value={75} />
      </div>
    </div>
  ),
}
