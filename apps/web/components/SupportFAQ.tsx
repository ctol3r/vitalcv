"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqData = [
  {
    id: "item-1",
    question: "What is a Blockchain CV?",
    answer:
      "A Blockchain CV is a tamper-proof, verifiable digital credential that stores your professional healthcare qualifications on a distributed ledger. Unlike traditional paper certificates, blockchain CVs cannot be forged or altered, providing instant verification of your medical licenses, certifications, and professional credentials. Each credential is cryptographically signed and linked to authoritative sources like state medical boards and certification bodies.",
  },
  {
    id: "item-2",
    question: "Where does NPI/licensure data come from?",
    answer:
      "VitalCV integrates directly with authoritative sources including the National Plan and Provider Enumeration System (NPPES) for NPI data, state medical boards for licensing information, and certification bodies like ABMS for board certifications. We maintain real-time connections to these databases to ensure your credentials reflect the most current status and automatically update when renewals or changes occur.",
  },
  {
    id: "item-3",
    question: "Who can see my profile?",
    answer:
      "Your VitalCV profile visibility is completely under your control. By default, profiles are private and only accessible via secure, time-limited verification links that you generate. You can share these links with employers, hospitals, or other authorized parties. No personal information is publicly searchable, and all access is logged for your security and audit purposes.",
  },
  {
    id: "item-4",
    question: "What if a license expires?",
    answer:
      "When a license approaches expiration, VitalCV automatically monitors renewal status through our integrations with licensing boards. You'll receive notifications before expiration, and the system will update your credential status in real-time once renewal is processed. If a license does expire, it will be marked as such in verification results, but historical validity periods remain intact for audit purposes.",
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
