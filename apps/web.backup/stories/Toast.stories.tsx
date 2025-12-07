"use client"

import type { Meta, StoryObj } from "@storybook/react"
import { Toast, ToastTitle, ToastDescription, ToastClose } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const meta: Meta<typeof Toast> = {
  title: "Components/Toast",
  component: Toast,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Toast>
      <div className="grid gap-1">
        <ToastTitle>Success</ToastTitle>
        <ToastDescription>Your changes have been saved.</ToastDescription>
      </div>
      <ToastClose />
    </Toast>
  ),
}

export const Success: Story = {
  render: () => (
    <Toast variant="success">
      <div className="grid gap-1">
        <ToastTitle>Success</ToastTitle>
        <ToastDescription>Profile updated successfully!</ToastDescription>
      </div>
      <ToastClose />
    </Toast>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Toast variant="destructive">
      <div className="grid gap-1">
        <ToastTitle>Error</ToastTitle>
        <ToastDescription>Something went wrong. Please try again.</ToastDescription>
      </div>
      <ToastClose />
    </Toast>
  ),
}

export const TitleOnly: Story = {
  render: () => (
    <Toast>
      <ToastTitle>Notification</ToastTitle>
      <ToastClose />
    </Toast>
  ),
}

export const DescriptionOnly: Story = {
  render: () => (
    <Toast>
      <ToastDescription>This is a simple notification message.</ToastDescription>
      <ToastClose />
    </Toast>
  ),
}

export const Interactive: Story = {
  render: function InteractiveToast() {
    const { toast } = useToast()

    return (
      <div className="space-y-2">
        <Button
          onClick={() =>
            toast({
              title: "Success",
              description: "Your action was completed successfully.",
              variant: "default",
            })
          }
        >
          Show Success Toast
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            toast({
              title: "Error",
              description: "Something went wrong.",
              variant: "destructive",
            })
          }
        >
          Show Error Toast
        </Button>
      </div>
    )
  },
}
