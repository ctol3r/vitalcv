import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="Enter your email" />
    </div>
  ),
}

export const Password: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="password">Password</Label>
      <Input id="password" type="password" placeholder="Enter your password" />
    </div>
  ),
}

export const Number: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="age">Age</Label>
      <Input id="age" type="number" placeholder="Enter your age" min={0} max={120} />
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: "Pre-filled value",
  },
}

export const Search: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="search">Search</Label>
      <Input id="search" type="search" placeholder="Search credentials..." />
    </div>
  ),
}

export const Tel: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="phone">Phone Number</Label>
      <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" />
    </div>
  ),
}

export const URL: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="website">Website</Label>
      <Input id="website" type="url" placeholder="https://example.com" />
    </div>
  ),
}
