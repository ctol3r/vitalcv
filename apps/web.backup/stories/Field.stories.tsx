import type { Meta, StoryObj } from "@storybook/react"
import { Field, InputField, TextareaField } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const meta: Meta<typeof Field> = {
  title: "Components/Field",
  component: Field,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const BasicField: Story = {
  args: {
    label: "Username",
    children: <Input placeholder="Enter your username" />,
  },
}

export const WithError: Story = {
  args: {
    label: "Email",
    error: "Please enter a valid email address",
    children: <Input placeholder="Enter your email" type="email" />,
  },
}

export const WithDescription: Story = {
  args: {
    label: "Password",
    description: "Must be at least 8 characters long",
    children: <Input placeholder="Enter your password" type="password" />,
  },
}

export const Required: Story = {
  args: {
    label: "Full Name",
    required: true,
    children: <Input placeholder="Enter your full name" />,
  },
}

export const InputFieldComponent: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <InputField label="Email" type="email" placeholder="Enter your email" required />
      <InputField label="Phone" type="tel" placeholder="Enter your phone" description="Include country code" />
      <InputField label="Website" type="url" placeholder="https://example.com" error="Please enter a valid URL" />
    </div>
  ),
}

export const TextareaFieldComponent: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <TextareaField label="Bio" placeholder="Tell us about yourself" description="Maximum 500 characters" />
      <TextareaField label="Comments" placeholder="Enter your comments" required error="This field is required" />
    </div>
  ),
}
