import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import {
  ArrowRight, BadgeCheck, Building2, CheckCircle, Clock,
  FileCheck2, Lock, Shield, ShieldCheck, Stethoscope,
} from "lucide-react"
import HeroSection from "@/components/marketing/HeroSection"
import NpiTerminal from "@/components/marketing/NpiTerminal"
import BentoGrid from "@/components/marketing/BentoGrid"
import Navbar from "@/components/marketing/Navbar"
import AcceptanceNetwork from "@/components/marketing/AcceptanceNetwork"
import ProductBento from "@/components/marketing/ProductBento"

// ── Section heading helper ─────────────────────────────────
function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--mist-blue)] mb-3">{eyebrow}</p>
      )}
      <h2 className="font-fraunces text-3xl md:text-4xl font-semibold tracking-tight text-[var(--warm-charcoal)]">{title}</h2>
      {subtitle && <p className="mt-3 text-base text-[var(--warm-charcoal)]/70 leading-relaxed">{subtitle}</p>}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Fixed nav */}
      <Navbar />

      {/* ── Dark hero ─────────────────────────── */}
      <HeroSection />

      {/* ── NPI Terminal (overlaps hero bottom) ── */}
      <div className="bg-slate-950">
        <NpiTerminal />
      </div>

      {/* ── Architecture bento (still dark) ───── */}
      <BentoGrid />

      {/* ── Transition to light ────────────────── */}
      <div className="h-16 bg-gradient-to-b from-slate-950 to-[var(--cloud-dancer,#f9f9f7)]" />

      {/* ── Problem section (light) ─────────────── */}
      <section className="py-20 px-6 bg-[var(--warm-charcoal)]/[0.02]">
        <SectionHeading eyebrow="The Problem" title="The 90–180 Day Bottleneck" subtitle="Credentialing is the #1 barrier to clinician deployment. Every day of delay costs revenue and patient access." />
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { stat: "90\u2013180", unit: "days", label: "Average time to credential a clinician" },
            { stat: "78%",      unit: "",      label: "Manual, paper-based verification steps" },
            { stat: "$7,500",   unit: "",      label: "Average cost per provider credentialed" },
          ].map((item) => (
            <GlassCard key={item.label}>
              <GlassCardContent className="text-center py-8">
                <p className="font-fraunces text-4xl font-semibold text-[var(--warm-charcoal)]">
                  {item.stat}{item.unit && <span className="text-lg font-normal text-[var(--warm-charcoal)]/50 ml-1">{item.unit}</span>}
                </p>
                <p className="mt-2 text-sm text-[var(--warm-charcoal)]/60">{item.label}</p>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ── Solution ──────────────────────────── */}
      <section className="py-20 px-6">
        <SectionHeading eyebrow="The Solution" title="Verified Once. Accepted Everywhere." subtitle="Clinicians build a reusable trust artifact that any employer can instantly verify — no redundant checks." />
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-8">
          {[
            { icon: BadgeCheck,   label: "Issuer Verifies",   color: "text-[var(--trust-green)]" },
            { icon: Stethoscope,  label: "Clinician Carries",  color: "text-[var(--mist-blue)]"   },
            { icon: Building2,    label: "Employer Trusts",    color: "text-[var(--trust-green)]" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-4">
              {i > 0 && <ArrowRight className="hidden md:block h-5 w-5 text-[var(--warm-charcoal)]/20 -ml-6 mr-2" />}
              <div className="flex flex-col items-center text-center">
                <div className={`w-14 h-14 rounded-2xl bg-[var(--warm-charcoal)]/5 flex items-center justify-center ${step.color}`}>
                  <step.icon className="h-7 w-7" />
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--warm-charcoal)]">{step.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product Bento ─────────────────────── */}
      <ProductBento />

      {/* ── How It Works ──────────────────────── */}
      <section id="how-it-works" className="py-20 px-6 bg-[var(--warm-charcoal)]/[0.02]">
        <SectionHeading eyebrow="How It Works" title="Three Steps to Trust" />
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: "1", icon: FileCheck2,  title: "Clinician Claims Credentials", desc: "Submit NPI and credentials. VitalCV retrieves and packages primary-source data." },
            { step: "2", icon: ShieldCheck, title: "Issuers Verify via PSV",        desc: "Automated primary source verification confirms license, DEA, board status, and exclusions." },
            { step: "3", icon: CheckCircle, title: "Employers Check Instantly",     desc: "View the trust state, CRS score, and decision window — accept or flag in seconds." },
          ].map((item) => (
            <GlassCard key={item.step}>
              <GlassCardContent className="py-8 px-6">
                <div className="w-10 h-10 rounded-xl bg-[var(--mist-blue)]/10 text-[var(--mist-blue)] flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-semibold text-[var(--mist-blue)] mb-1">Step {item.step}</div>
                <h3 className="text-base font-semibold text-[var(--warm-charcoal)] mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--warm-charcoal)]/60 leading-relaxed">{item.desc}</p>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ── Security badges ───────────────────── */}
      <section id="security" className="py-20 px-6">
        <SectionHeading eyebrow="Trust &amp; Compliance" title="Built for Healthcare Compliance" subtitle="Every verification is cryptographically signed, tamper-evident, and aligned with industry standards." />
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {["NCQA-Aligned","CMS-Compatible","HIPAA-Aware","SOC 2 Roadmap","Tamper-Evident","ES256 Signatures"].map((badge) => (
            <div key={badge} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[var(--trust-green)]/10 text-[var(--trust-green)]">
              <Shield className="h-3.5 w-3.5" />{badge}
            </div>
          ))}
        </div>
      </section>

      <AcceptanceNetwork />

      {/* ── Portal Access ─────────────────────── */}
      <section id="portals" className="py-20 px-6">
        <SectionHeading eyebrow="Get Started" title="Choose Your Portal" subtitle="VitalCV serves every stakeholder in the credentialing chain." />
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Stethoscope, role: "Clinician", desc: "Claim credentials, build your trust artifact, share with employers.",   href: "/holder",   cta: "Enter Wallet"       },
            { icon: Building2,   role: "Employer",  desc: "Verify clinician trust state, check CRS scores, accept or flag.",       href: "/verifier", cta: "Verify Provider"    },
            { icon: BadgeCheck,  role: "Issuer",    desc: "Manage credential issuance and primary-source verification.",           href: "/issuer",   cta: "Issue Credentials"  },
          ].map((portal) => (
            <GlassCard key={portal.role} weight="heavy">
              <GlassCardContent className="py-10 px-6 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--mist-blue)]/10 text-[var(--mist-blue)] flex items-center justify-center mb-5">
                  <portal.icon className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--warm-charcoal)] mb-2">{portal.role}</h3>
                <p className="text-sm text-[var(--warm-charcoal)]/60 mb-6 leading-relaxed">{portal.desc}</p>
                <Button asChild className="w-full gap-2">
                  <Link href={portal.href}>{portal.cta}<ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────── */}
      <footer className="border-t border-[var(--warm-charcoal)]/5 py-8 px-6 bg-[var(--cloud-dancer,#f9f9f7)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--warm-charcoal)]/40">
          <p>&copy; 2026 VitalCV. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Lock className="h-3 w-3" /><span>Privacy</span><span>Terms</span><span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
