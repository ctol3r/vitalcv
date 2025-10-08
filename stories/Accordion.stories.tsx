import type { Meta, StoryObj } from "@storybook/react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const meta: Meta<typeof Accordion> = {
  title: "Components/Accordion",
  component: Accordion,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      <AccordionItem value="item-1">
        <AccordionTrigger>What is a Verifiable Credential?</AccordionTrigger>
        <AccordionContent>
          A Verifiable Credential is a tamper-evident credential with cryptographic proof that can be verified without
          contacting the issuer.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How do I verify a credential?</AccordionTrigger>
        <AccordionContent>
          Enter the credential ID in the verification field and click Verify. The system will check the cryptographic
          signature and revocation status.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>What happens when a credential is revoked?</AccordionTrigger>
        <AccordionContent>
          A revoked credential is immediately invalidated and will fail verification. The holder is notified and the
          revocation is recorded in the audit trail.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" className="w-96">
      <AccordionItem value="item-1">
        <AccordionTrigger>Medical License</AccordionTrigger>
        <AccordionContent>State-issued license to practice medicine. Valid for 2 years.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Board Certification</AccordionTrigger>
        <AccordionContent>Specialty certification from ABMS member board. Requires MOC.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>NPI Number</AccordionTrigger>
        <AccordionContent>Unique 10-digit identifier for healthcare providers from CMS.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}
