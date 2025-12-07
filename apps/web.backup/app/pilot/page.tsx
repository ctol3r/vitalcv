"use client"

import { useState } from "react"
import { Building2, CheckCircle2, Loader2, Mail, Shield, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface PilotSignupPayload {
  orgName: string
  contactName: string
  email: string
  notes: string
}

const HIGHLIGHTS = [
  "Day-1 credentialing readiness report with NCQA coverage",
  "Automated privilege + payer enrollment playbooks",
  "Live compliance telemetry and exec briefings",
]

const STATS = [
  { label: "Faster onboarding", value: "42 days" },
  { label: "Coverage accuracy", value: "99.3%" },
  { label: "Pilot cohorts", value: "17 health systems" },
]

export default function PilotSignupPage() {
  const [form, setForm] = useState<PilotSignupPayload>({
    orgName: "",
    contactName: "",
    email: "",
    notes: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ orgName: string; signupId?: string } | null>(null)

  const handleChange = (field: keyof PilotSignupPayload) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/pilot/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 202) {
        setSuccess({
          orgName: form.orgName,
          signupId: data?.signupId,
        })
        setForm({
          orgName: "",
          contactName: "",
          email: "",
          notes: "",
        })
      } else {
        const message =
          data?.message ||
          data?.error ||
          "We couldn't capture your info right now. Please try again."
        setError(message)
      }
    } catch (err) {
      console.error("Pilot signup failed", err)
      setError("Network issue — please retry in a moment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-sm uppercase tracking-widest text-white/80">
              <Shield className="h-4 w-4 text-emerald-300" />
              Vital Pilot Program
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Credential-ready in weeks, not quarters.
            </h1>
            <p className="mt-6 text-lg text-white/80">
              Join a tight cohort of health systems digitizing privileging, payer enrollment,
              and compliance telemetry in one workspace. We take your existing spreadsheets,
              policies, and checklists and return a living control tower.
            </p>

            <div className="mt-10 space-y-4">
              {HIGHLIGHTS.map((item) => (
                <div key={item} className="flex items-start gap-3 text-base text-white/90">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                  <div className="text-xs uppercase tracking-wider text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <Card className="border-white/10 bg-white text-slate-900 shadow-2xl shadow-emerald-500/10">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Tell us about your team</CardTitle>
              <CardDescription>
                We review every submission and confirm next steps within 2 business days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success && (
                <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-900">
                  <AlertTitle className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Thanks, {success.orgName}!
                  </AlertTitle>
                  <AlertDescription>
                    We received your request
                    {success.signupId ? (
                      <>
                        {" "}
                        (<span className="font-mono text-xs">{success.signupId}</span>)
                      </>
                    ) : null}
                    . Our pilot team will reach out with onboarding steps and a readiness
                    workbook shortly.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Something went wrong</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input
                    id="orgName"
                    value={form.orgName}
                    onChange={(e) => handleChange("orgName")(e.target.value)}
                    placeholder="Metro Regional Health"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Primary contact</Label>
                  <Input
                    id="contactName"
                    value={form.contactName}
                    onChange={(e) => handleChange("contactName")(e.target.value)}
                    placeholder="Jordan Ellis, VP Credentialing"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email")(e.target.value)}
                    placeholder="jordan.ellis@healthsystem.org"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">What problem are you solving?</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => handleChange("notes")(e.target.value)}
                    placeholder="e.g., Reduce payer enrollment backlog, automate telehealth privilege reviews..."
                    rows={4}
                    maxLength={2000}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-slate-500">
                    Helpful context: number of providers, onboarding goals, systems you currently use.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending to Vital pilots…
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Request pilot invite
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 grid gap-4 rounded-xl bg-slate-50/80 p-4 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span>Dedicated Vital pilot pod with exec sponsor + solution engineer</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span>Invite up to 10 stakeholders for weekly readiness reviews</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-slate-400" />
                  <span>HIPAA-ready workspace with audit logging + scoped sandboxes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

