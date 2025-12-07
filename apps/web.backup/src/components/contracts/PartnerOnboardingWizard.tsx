'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Building2, FileText, DollarSign, UserPlus, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'

interface PartnerOnboardingWizardProps {
  orgId: string
  onComplete: (contractId: string) => void
  onCancel: () => void
  initialTemplateId?: string
}

interface OrgInfo {
  name: string
  email: string
  phone?: string
  address?: string
}

interface TemplateSelection {
  templateId: string
  templateName: string
}

interface RevenueShareTerms {
  basisPoints: number
  minGuarantee?: number
  maxCap?: number
}

interface Signatory {
  email: string
  name: string
  role: string
}

const STEPS = [
  { id: 'org-info', label: 'Organization Info', icon: Building2 },
  { id: 'template', label: 'Select Template', icon: FileText },
  { id: 'revenue-share', label: 'Revenue Share Terms', icon: DollarSign },
  { id: 'signatories', label: 'Invite Signatories', icon: UserPlus },
  { id: 'review', label: 'Review & Create', icon: CheckCircle2 },
]

export function PartnerOnboardingWizard({
  orgId,
  onComplete,
  onCancel,
  initialTemplateId,
}: PartnerOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [orgInfo, setOrgInfo] = useState<OrgInfo>({
    name: '',
    email: '',
    phone: '',
    address: '',
  })

  const [templateSelection, setTemplateSelection] = useState<TemplateSelection | null>(
    initialTemplateId ? { templateId: initialTemplateId, templateName: '' } : null
  )

  const [revenueShareTerms, setRevenueShareTerms] = useState<RevenueShareTerms>({
    basisPoints: 0,
    minGuarantee: undefined,
    maxCap: undefined,
  })

  const [signatories, setSignatories] = useState<Signatory[]>([])

  const [availableTemplates, setAvailableTemplates] = useState<Array<{ id: string; name: string }>>([])

  // Load templates when step changes to template selection
  useEffect(() => {
    if (currentStep === 1) {
      loadTemplates()
    }
  }, [currentStep])

  async function loadTemplates() {
    try {
      const response = await fetch('/api/demo/org/contracts/templates?type=revenue_share')
      if (response.ok) {
        const payload = await response.json()
        setAvailableTemplates(payload.templates?.map((t: any) => ({ id: t.id, name: t.name })) || [])
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  function validateStep(step: number): boolean {
    switch (step) {
      case 0:
        return !!(orgInfo.name && orgInfo.email)
      case 1:
        return !!templateSelection
      case 2:
        return revenueShareTerms.basisPoints > 0 && revenueShareTerms.basisPoints <= 10000
      case 3:
        return signatories.length > 0 && signatories.every((s) => s.email && s.name)
      case 4:
        return true
      default:
        return false
    }
  }

  function handleNext() {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1)
        setError(null)
      } else {
        handleSubmit()
      }
    } else {
      setError('Please complete all required fields')
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/demo/org/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          counterpartyInfo: orgInfo,
          templateId: templateSelection?.templateId,
          revenueShareTerms,
          signatories,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create contract')
      }

      const payload = await response.json()
      onComplete(payload.contractId)
    } catch (err: any) {
      setError(err.message || 'Failed to create contract')
    } finally {
      setLoading(false)
    }
  }

  function addSignatory() {
    setSignatories([...signatories, { email: '', name: '', role: '' }])
  }

  function updateSignatory(index: number, field: keyof Signatory, value: string) {
    const updated = [...signatories]
    updated[index] = { ...updated[index], [field]: value }
    setSignatories(updated)
  }

  function removeSignatory(index: number) {
    setSignatories(signatories.filter((_, i) => i !== index))
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <span className="font-medium">{STEPS[currentStep].label}</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {STEPS[currentStep].icon && (
              <STEPS[currentStep].icon className="h-5 w-5" />
            )}
            {STEPS[currentStep].label}
          </CardTitle>
          <CardDescription>
            {currentStep === 0 && 'Enter the partner organization information'}
            {currentStep === 1 && 'Select a contract template to use'}
            {currentStep === 2 && 'Configure revenue share terms'}
            {currentStep === 3 && 'Invite signatories who will sign the contract'}
            {currentStep === 4 && 'Review all information before creating the contract'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Organization Info */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">
                  Organization Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="org-name"
                  value={orgInfo.name}
                  onChange={(e) => setOrgInfo({ ...orgInfo, name: e.target.value })}
                  placeholder="Acme Healthcare Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="org-email"
                  type="email"
                  value={orgInfo.email}
                  onChange={(e) => setOrgInfo({ ...orgInfo, email: e.target.value })}
                  placeholder="contact@acmehealth.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Phone</Label>
                <Input
                  id="org-phone"
                  type="tel"
                  value={orgInfo.phone}
                  onChange={(e) => setOrgInfo({ ...orgInfo, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address">Address</Label>
                <Input
                  id="org-address"
                  value={orgInfo.address}
                  onChange={(e) => setOrgInfo({ ...orgInfo, address: e.target.value })}
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>
            </div>
          )}

          {/* Step 1: Template Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template">
                  Contract Template <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={templateSelection?.templateId || ''}
                  onValueChange={(value) => {
                    const template = availableTemplates.find((t) => t.id === value)
                    if (template) {
                      setTemplateSelection({ templateId: value, templateName: template.name })
                    }
                  }}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {templateSelection && (
                <div className="text-sm text-muted-foreground">
                  Selected: {templateSelection.templateName || templateSelection.templateId}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Revenue Share Terms */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="basis-points">
                  Revenue Share (basis points) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="basis-points"
                  type="number"
                  min="0"
                  max="10000"
                  value={revenueShareTerms.basisPoints}
                  onChange={(e) =>
                    setRevenueShareTerms({
                      ...revenueShareTerms,
                      basisPoints: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="500 (5%)"
                />
                <p className="text-xs text-muted-foreground">
                  100 basis points = 1%. Enter value between 0 and 10000.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-guarantee">Minimum Guarantee (optional)</Label>
                <Input
                  id="min-guarantee"
                  type="number"
                  min="0"
                  value={revenueShareTerms.minGuarantee || ''}
                  onChange={(e) =>
                    setRevenueShareTerms({
                      ...revenueShareTerms,
                      minGuarantee: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-cap">Maximum Cap (optional)</Label>
                <Input
                  id="max-cap"
                  type="number"
                  min="0"
                  value={revenueShareTerms.maxCap || ''}
                  onChange={(e) =>
                    setRevenueShareTerms({
                      ...revenueShareTerms,
                      maxCap: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="1000000"
                />
              </div>
            </div>
          )}

          {/* Step 3: Signatories */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Signatories</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSignatory}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Signatory
                </Button>
              </div>
              {signatories.map((signatory, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Signatory {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSignatory(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`signatory-name-${index}`}>
                          Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`signatory-name-${index}`}
                          value={signatory.name}
                          onChange={(e) => updateSignatory(index, 'name', e.target.value)}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`signatory-email-${index}`}>
                          Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`signatory-email-${index}`}
                          type="email"
                          value={signatory.email}
                          onChange={(e) => updateSignatory(index, 'email', e.target.value)}
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`signatory-role-${index}`}>Role</Label>
                      <Input
                        id={`signatory-role-${index}`}
                        value={signatory.role}
                        onChange={(e) => updateSignatory(index, 'role', e.target.value)}
                        placeholder="CEO, Legal Counsel, etc."
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {signatories.length === 0 && (
                <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                  <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No signatories added yet</p>
                  <p className="text-sm mt-1">Click "Add Signatory" to invite someone</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Organization Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><strong>Name:</strong> {orgInfo.name}</div>
                  <div><strong>Email:</strong> {orgInfo.email}</div>
                  {orgInfo.phone && <div><strong>Phone:</strong> {orgInfo.phone}</div>}
                  {orgInfo.address && <div><strong>Address:</strong> {orgInfo.address}</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Template</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {templateSelection?.templateName || templateSelection?.templateId || 'Custom'}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenue Share Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><strong>Basis Points:</strong> {revenueShareTerms.basisPoints} ({revenueShareTerms.basisPoints / 100}%)</div>
                  {revenueShareTerms.minGuarantee && (
                    <div><strong>Min Guarantee:</strong> ${revenueShareTerms.minGuarantee.toLocaleString()}</div>
                  )}
                  {revenueShareTerms.maxCap && (
                    <div><strong>Max Cap:</strong> ${revenueShareTerms.maxCap.toLocaleString()}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Signatories ({signatories.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {signatories.map((signatory, index) => (
                    <div key={index}>
                      <strong>{signatory.name}</strong> ({signatory.email})
                      {signatory.role && <span className="text-muted-foreground"> - {signatory.role}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={currentStep === 0 ? onCancel : handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button onClick={handleNext} disabled={loading}>
          {loading ? (
            'Creating...'
          ) : currentStep === STEPS.length - 1 ? (
            'Create Contract'
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

