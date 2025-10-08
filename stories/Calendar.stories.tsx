import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"

const meta: Meta<typeof Calendar> = {
  title: "Components/Calendar",
  component: Calendar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date())
    return <Calendar mode="single" selected={date} onSelect={setDate} />
  },
}

export const WithLabel: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>()
    return (
      <div className="space-y-2">
        <Label>Select expiration date</Label>
        <Calendar mode="single" selected={date} onSelect={setDate} />
      </div>
    )
  },
}

export const DisabledDates: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>()
    return (
      <div className="space-y-2">
        <Label>Select credential issue date</Label>
        <Calendar mode="single" selected={date} onSelect={setDate} disabled={(date) => date > new Date()} />
        <p className="text-xs text-muted-foreground">Future dates are disabled</p>
      </div>
    )
  },
}

export const DateRange: Story = {
  render: () => {
    const [date, setDate] = useState<{ from?: Date; to?: Date }>()
    return (
      <div className="space-y-2">
        <Label>Select credential validity period</Label>
        <Calendar mode="range" selected={date} onSelect={setDate as any} numberOfMonths={2} />
      </div>
    )
  },
}
