import type { Meta, StoryObj } from "@storybook/react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

const meta: Meta<typeof RadioGroup> = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <RadioGroup defaultValue="option1">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option1" id="option1" />
        <Label htmlFor="option1">Option 1</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option2" id="option2" />
        <Label htmlFor="option2">Option 2</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option3" id="option3" />
        <Label htmlFor="option3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
}

export const WithDescription: Story = {
  render: () => (
    <RadioGroup defaultValue="standard">
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <RadioGroupItem value="standard" id="standard" className="mt-1" />
          <div>
            <Label htmlFor="standard" className="font-semibold">
              Standard Verification
            </Label>
            <p className="text-sm text-muted-foreground">Basic credential status check</p>
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <RadioGroupItem value="enhanced" id="enhanced" className="mt-1" />
          <div>
            <Label htmlFor="enhanced" className="font-semibold">
              Enhanced Verification
            </Label>
            <p className="text-sm text-muted-foreground">Includes audit trail and compliance checks</p>
          </div>
        </div>
      </div>
    </RadioGroup>
  ),
}

export const DisclosureType: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="font-semibold">Select disclosure type:</div>
      <RadioGroup defaultValue="full">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="full" id="full" />
          <Label htmlFor="full">Full Disclosure</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="selective" id="selective" />
          <Label htmlFor="selective">Selective Disclosure</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="minimal" id="minimal" />
          <Label htmlFor="minimal">Minimal Disclosure</Label>
        </div>
      </RadioGroup>
    </div>
  ),
}
