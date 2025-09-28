"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqData = [
  {
    id: "item-1",
    question: "How do I verify a credential?",
    answer:
      "To verify a credential, navigate to the Verify page and enter the credential ID. You can optionally provide a nonce and audience for additional security. Click 'Verify Credential' to get instant results showing whether the credential is valid, revoked, or unknown.",
  },
  {
    id: "item-2",
    question: "What types of credentials can be verified?",
    answer:
      "VitalCV supports verification of various healthcare credentials including medical licenses, board certifications, DEA registrations, nursing licenses, and other professional healthcare certifications. All credentials are backed by blockchain technology for tamper-proof verification.",
  },
  {
    id: "item-3",
    question: "How secure is the verification process?",
    answer:
      "Our verification process uses blockchain technology with cryptographic signatures to ensure credentials cannot be tampered with or forged. All data is encrypted in transit and at rest, and we maintain full HIPAA, GDPR, and SOC2 compliance with comprehensive audit trails.",
  },
  {
    id: "item-4",
    question: "What should I do if a credential shows as revoked?",
    answer:
      "If a credential shows as revoked, this means the issuing authority has invalidated it. Contact the credential holder to obtain an updated, valid credential. The system will show the reason for revocation and the date it was revoked to help you understand the situation.",
  },
]

export function SupportFAQ() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqData.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="text-left hover:text-blue-600 transition-colors">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-gray-600 leading-relaxed">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
