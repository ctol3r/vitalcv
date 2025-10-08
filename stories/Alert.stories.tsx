import type { Meta, StoryObj } from "@storybook/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react"

const meta: Meta<typeof Alert> = {
  title: "Components/Alert",
  component: Alert,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Alert className="w-96">
      <Info className="h-4 w-4" />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>You can add components to your app using the cli.</AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="w-96">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
    </Alert>
  ),
}

export const Success: Story = {
  render: () => (
    <Alert className="w-96 border-success/20 bg-success/10 text-success-foreground">
      <CheckCircle className="h-4 w-4" />
      <AlertTitle>Success</AlertTitle>
      <AlertDescription>Your credential has been successfully verified.</AlertDescription>
    </Alert>
  ),
}

export const Warning: Story = {
  render: () => (
    <Alert className="w-96 border-warning/30 bg-warning/10 text-warning-foreground">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Warning</AlertTitle>
      <AlertDescription>Your credential will expire in 30 days. Please renew it soon.</AlertDescription>
    </Alert>
  ),
}

export const WithoutTitle: Story = {
  render: () => (
    <Alert className="w-96">
      <Info className="h-4 w-4" />
      <AlertDescription>This is an alert without a title.</AlertDescription>
    </Alert>
  ),
}

export const CredentialVerification: Story = {
  render: () => (
    <div className="space-y-4 w-96">
      <Alert className="border-success/20 bg-success/10 text-success-foreground">
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Credential Valid</AlertTitle>
        <AlertDescription>This credential has been successfully verified and is currently active.</AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Credential Revoked</AlertTitle>
        <AlertDescription>This credential has been revoked and is no longer valid.</AlertDescription>
      </Alert>

      <Alert className="border-warning/30 bg-warning/10 text-warning-foreground">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Credential Expired</AlertTitle>
        <AlertDescription>This credential has expired. Please contact the issuer for renewal.</AlertDescription>
      </Alert>
    </div>
  ),
}
