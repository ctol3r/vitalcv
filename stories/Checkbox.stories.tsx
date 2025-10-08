import type { Meta, StoryObj } from "@storybook/react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    id: "checkbox",
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
}

export const Checked: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="checked" defaultChecked />
      <Label htmlFor="checked">I agree</Label>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="disabled" disabled />
      <Label htmlFor="disabled" className="opacity-50">
        Disabled checkbox
      </Label>
    </div>
  ),
}

export const CheckedDisabled: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="checked-disabled" defaultChecked disabled />
      <Label htmlFor="checked-disabled" className="opacity-50">
        Checked and disabled
      </Label>
    </div>
  ),
}

export const CredentialSelection: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="font-semibold">Select credentials to share:</div>
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox id="license" defaultChecked />
          <Label htmlFor="license">Medical License</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="npi" defaultChecked />
          <Label htmlFor="npi">NPI Number</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="board" />
          <Label htmlFor="board">Board Certification</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="address" disabled />
          <Label htmlFor="address" className="opacity-50">
            Home Address (not available)
          </Label>
        </div>
      </div>
    </div>
  ),
}
