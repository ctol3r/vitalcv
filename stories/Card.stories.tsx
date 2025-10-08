import type { Meta, StoryObj } from "@storybook/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreVertical } from "lucide-react"

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the main content of the card. It can contain any React elements.</p>
      </CardContent>
    </Card>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Confirm Action</CardTitle>
        <CardDescription>This action cannot be undone</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Are you sure you want to proceed with this operation?</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Confirm</Button>
      </CardFooter>
    </Card>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>New message from John</span>
            <Badge variant="default">New</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Meeting reminder</span>
            <Badge variant="secondary">1h</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
}

export const DarkMode: Story = {
  render: () => (
    <div className="dark">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Dark Mode Card</CardTitle>
          <CardDescription>This card adapts to dark mode</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card components automatically support dark mode through semantic color tokens.</p>
        </CardContent>
        <CardFooter>
          <Button>Learn More</Button>
        </CardFooter>
      </Card>
    </div>
  ),
}

export const CredentialCard: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Medical License</CardTitle>
        <CardDescription>State of California</CardDescription>
        <CardAction>
          <Badge variant="default">Valid</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">License Number:</span>
            <span className="font-mono">CA123456</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Issued:</span>
            <span>Jan 15, 2020</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expires:</span>
            <span>Jan 15, 2026</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1">
          Share
        </Button>
        <Button className="flex-1">View Details</Button>
      </CardFooter>
    </Card>
  ),
}
