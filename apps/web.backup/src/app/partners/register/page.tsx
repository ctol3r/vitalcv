'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  User,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface FormData {
  partnerName: string
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  contactPhone: string
  companyWebsite: string
  description: string
}

interface FormErrors {
  [key: string]: string
}

export default function PartnerRegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    partnerName: '',
    contactFirstName: '',
    contactLastName: '',
    contactEmail: '',
    contactPhone: '',
    companyWebsite: '',
    description: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.partnerName.trim()) {
      newErrors.partnerName = 'Partner name is required'
    }

    if (!formData.contactFirstName.trim()) {
      newErrors.contactFirstName = 'First name is required'
    }

    if (!formData.contactLastName.trim()) {
      newErrors.contactLastName = 'Last name is required'
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address'
    }

    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = 'Phone number is required'
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.contactPhone)) {
      newErrors.contactPhone = 'Please enter a valid phone number'
    }

    if (formData.companyWebsite && !/^https?:\/\/.+/.test(formData.companyWebsite)) {
      newErrors.companyWebsite = 'Please enter a valid URL (starting with http:// or https://)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const response = await fetch('/api/partners/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Registration failed. Please try again.')
      }

      setIsSuccess(true)
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/partners/dashboard')
      }, 3000)
    } catch (err: any) {
      setErrors({
        submit: err.message || 'An error occurred. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  if (isSuccess) {
    return (
      <div className="container mx-auto max-w-2xl py-12 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <div>
                <h2 className="text-2xl font-semibold mb-2">Registration Successful!</h2>
                <p className="text-muted-foreground mb-4">
                  Thank you for registering as a partner. We've received your information and will
                  review it shortly.
                </p>
                <p className="text-sm text-muted-foreground">
                  You'll receive an email confirmation shortly. Redirecting to dashboard...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Partner Registration</h1>
        <p className="text-muted-foreground">
          Join our partner network. Fill out the form below to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Partner Information
            </CardTitle>
            <CardDescription>
              Tell us about your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="partnerName">
                Partner/Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="partnerName"
                type="text"
                value={formData.partnerName}
                onChange={handleChange('partnerName')}
                placeholder="Acme Healthcare Solutions"
                aria-required="true"
                aria-invalid={!!errors.partnerName}
                aria-describedby={errors.partnerName ? 'partnerName-error' : undefined}
              />
              {errors.partnerName && (
                <p id="partnerName-error" className="text-sm text-destructive" role="alert">
                  {errors.partnerName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyWebsite">Company Website</Label>
              <Input
                id="companyWebsite"
                type="url"
                value={formData.companyWebsite}
                onChange={handleChange('companyWebsite')}
                placeholder="https://example.com"
                aria-invalid={!!errors.companyWebsite}
                aria-describedby={errors.companyWebsite ? 'companyWebsite-error' : undefined}
              />
              {errors.companyWebsite && (
                <p id="companyWebsite-error" className="text-sm text-destructive" role="alert">
                  {errors.companyWebsite}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={handleChange('description')}
                placeholder="Brief description of your organization and partnership goals"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Primary Contact Person
            </CardTitle>
            <CardDescription>
              Who should we contact about this partnership?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactFirstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contactFirstName"
                  type="text"
                  value={formData.contactFirstName}
                  onChange={handleChange('contactFirstName')}
                  placeholder="John"
                  aria-required="true"
                  aria-invalid={!!errors.contactFirstName}
                  aria-describedby={errors.contactFirstName ? 'contactFirstName-error' : undefined}
                />
                {errors.contactFirstName && (
                  <p
                    id="contactFirstName-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.contactFirstName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactLastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contactLastName"
                  type="text"
                  value={formData.contactLastName}
                  onChange={handleChange('contactLastName')}
                  placeholder="Doe"
                  aria-required="true"
                  aria-invalid={!!errors.contactLastName}
                  aria-describedby={errors.contactLastName ? 'contactLastName-error' : undefined}
                />
                {errors.contactLastName && (
                  <p
                    id="contactLastName-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.contactLastName}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange('contactEmail')}
                placeholder="john.doe@example.com"
                aria-required="true"
                aria-invalid={!!errors.contactEmail}
                aria-describedby={errors.contactEmail ? 'contactEmail-error' : undefined}
              />
              {errors.contactEmail && (
                <p id="contactEmail-error" className="text-sm text-destructive" role="alert">
                  {errors.contactEmail}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={handleChange('contactPhone')}
                placeholder="+1 (555) 123-4567"
                aria-required="true"
                aria-invalid={!!errors.contactPhone}
                aria-describedby={errors.contactPhone ? 'contactPhone-error' : undefined}
              />
              {errors.contactPhone && (
                <p id="contactPhone-error" className="text-sm text-destructive" role="alert">
                  {errors.contactPhone}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {errors.submit && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Registration
          </Button>
        </div>
      </form>
    </div>
  )
}

