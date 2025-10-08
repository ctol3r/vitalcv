import type { Meta, StoryObj } from "@storybook/react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-80">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithLabel: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="credential-type">Credential Type</Label>
      <Select>
        <SelectTrigger id="credential-type">
          <SelectValue placeholder="Select credential type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="license">Medical License</SelectItem>
          <SelectItem value="npi">NPI Number</SelectItem>
          <SelectItem value="board">Board Certification</SelectItem>
          <SelectItem value="dea">DEA Registration</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-80">
        <SelectValue placeholder="Select a credential" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Licenses</SelectLabel>
          <SelectItem value="medical-license">Medical License</SelectItem>
          <SelectItem value="nursing-license">Nursing License</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Certifications</SelectLabel>
          <SelectItem value="board-cert">Board Certification</SelectItem>
          <SelectItem value="cme">CME Credits</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Registration</SelectLabel>
          <SelectItem value="npi">NPI Number</SelectItem>
          <SelectItem value="dea">DEA Registration</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}

export const CredentialStatus: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="status">Filter by Status</Label>
      <Select defaultValue="all">
        <SelectTrigger id="status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Credentials</SelectItem>
          <SelectItem value="valid">✓ Valid</SelectItem>
          <SelectItem value="expired">⚠ Expired</SelectItem>
          <SelectItem value="revoked">✗ Revoked</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}
