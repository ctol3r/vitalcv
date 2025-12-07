'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Building2, FileText, CheckCircle2, Upload, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'

interface VendorOnboardingWizardProps {
  onComplete: (vendorId: string) => void
  onCancel: () => void
}

interface VendorDetails {
  name: string
  email: string
  phone?: string
  website?: string
  address?: string
  taxId?: string
  description?: string
}

interface CategorySelection {
  categoryId: string
  categoryName: string
}

interface DueDiligenceAnswer {
  questionId: string
  question: string
  answer: string
  required: boolean
}

interface DocumentUpload {
  file: File
  type: string
  name: string
}

interface ContractSelection {
  contractId: string
  contractName: string
}

const STEPS = [
  { id: 'details', label: 'Vendor Details', icon: Building2 },
  { id: 'category', label: 'Category Selection', icon: FileText },
  { id: 'due-diligence', label: 'Due Diligence', icon: CheckCircle2 },
  { id: 'documents', label: 'Document Upload', icon: Upload },
  { id: 'contract', label: 'Contract Selection', icon: FileText },
  { id: 'review', label: 'Review & Submit', icon: CheckCircle2 },
]

export function VendorOnboardingWizard({
  onComplete,
  onCancel,
}: VendorOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [vendorDetails, setVendorDetails] = useState<VendorDetails>({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    taxId: '',
    description: '',
  })

  const [categorySelection, setCategorySelection] = useState<CategorySelection | null>(null)
  const [availableCategories, setAvailableCategories] = useState<Array<{ id: string; name: string }>>([])
  const [dueDiligenceAnswers, setDueDiligenceAnswers] = useState<DueDiligenceAnswer[]>([])
  const [availableQuestions, setAvailableQuestions] = useState<Array<{ id: string; question: string; required: boolean }>>([])
  const [documents, setDocuments] = useState<DocumentUpload[]>([])
  const [contractSelection, setContractSelection] = useState<ContractSelection | null>(null)
  const [availableContracts, setAvailableContracts] = useState<Array<{ id: string; name: string }>>([])

  // Load data when steps change
  useEffect(() => {
    if (currentStep === 1) {
      loadCategories()
    } else if (currentStep === 2) {
      loadDueDiligenceQuestions()
    } else if (currentStep === 3) {
      // Documents step - no API call needed
    } else if (currentStep === 4) {
      loadContracts()
    }
  }, [currentStep])

  async function loadCategories() {
    try {
      const response = await fetch('/api/demo/vendor/categories')
      if (response.ok) {
        const payload = await response.json()
        setAvailableCategories(payload.categories || [])
      }
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  async function loadDueDiligenceQuestions() {
    try {
      const categoryId = categorySelection?.categoryId
      if (!categoryId) return

      const response = await fetch(`/api/demo/vendor/categories/${categoryId}/due-diligence`)
      if (response.ok) {
        const payload = await response.json()
        const questions = payload.questions || []
        setAvailableQuestions(questions)
        // Initialize answers
        setDueDiligenceAnswers(
          questions.map((q: any) => ({
            questionId: q.id,
            question: q.question,
            answer: '',
            required: q.required,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load due diligence questions:', err)
    }
  }

  async function loadContracts() {
    try {
      const response = await fetch('/api/demo/vendor/contracts/templates')
      if (response.ok) {
        const payload = await response.json()
        setAvailableContracts(payload.templates || [])
      }
    } catch (err) {
      console.error('Failed to load contracts:', err)
    }
  }

  function validateStep(step: number): boolean {
    switch (step) {
      case 0:
        return !!(vendorDetails.name && vendorDetails.email)
      case 1:
        return !!categorySelection
      case 2:
        return dueDiligenceAnswers.every(
          (a) => !a.required || (a.required && a.answer.trim().length > 0)
        )
      case 3:
        // Documents are optional but can be validated if needed
        return true
      case 4:
        return !!contractSelection
      case 5:
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
      const formData = new FormData()
      formData.append('vendorDetails', JSON.stringify(vendorDetails))
      formData.append('categoryId', categorySelection?.categoryId || '')
      formData.append('dueDiligenceAnswers', JSON.stringify(dueDiligenceAnswers))
      formData.append('contractId', contractSelection?.contractId || '')

      documents.forEach((doc, index) => {
        formData.append(`document_${index}`, doc.file)
        formData.append(`document_${index}_type`, doc.type)
        formData.append(`document_${index}_name`, doc.name)
      })

      const response = await fetch('/api/demo/vendor/onboard', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to onboard vendor')
      }

      const payload = await response.json()
      onComplete(payload.vendorId)
    } catch (err: any) {
      setError(err.message || 'Failed to onboard vendor')
    } finally {
      setLoading(false)
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>, type: string) {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      setDocuments([
        ...documents,
        {
          file,
          type,
          name: file.name,
        },
      ])
    })
  }

  function removeDocument(index: number) {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  function updateDueDiligenceAnswer(index: number, answer: string) {
    const updated = [...dueDiligenceAnswers]
    updated[index] = { ...updated[index], answer }
    setDueDiligenceAnswers(updated)
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
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p>{error}</p>
            </div>
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
            {currentStep === 0 && 'Enter basic vendor information'}
            {currentStep === 1 && 'Select the vendor category'}
            {currentStep === 2 && 'Answer due diligence questions'}
            {currentStep === 3 && 'Upload required documents'}
            {currentStep === 4 && 'Select a contract template'}
            {currentStep === 5 && 'Review all information before submitting'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Vendor Details */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-name">
                  Vendor Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vendor-name"
                  value={vendorDetails.name}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, name: e.target.value })}
                  placeholder="Acme Healthcare Services"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={vendorDetails.email}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, email: e.target.value })}
                  placeholder="contact@acmehealth.com"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vendor-phone">Phone</Label>
                  <Input
                    id="vendor-phone"
                    type="tel"
                    value={vendorDetails.phone}
                    onChange={(e) => setVendorDetails({ ...vendorDetails, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-website">Website</Label>
                  <Input
                    id="vendor-website"
                    type="url"
                    value={vendorDetails.website}
                    onChange={(e) => setVendorDetails({ ...vendorDetails, website: e.target.value })}
                    placeholder="https://www.acmehealth.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-address">Address</Label>
                <Input
                  id="vendor-address"
                  value={vendorDetails.address}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, address: e.target.value })}
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-tax-id">Tax ID / EIN</Label>
                <Input
                  id="vendor-tax-id"
                  value={vendorDetails.taxId}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, taxId: e.target.value })}
                  placeholder="12-3456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-description">Description</Label>
                <Textarea
                  id="vendor-description"
                  value={vendorDetails.description}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, description: e.target.value })}
                  placeholder="Brief description of the vendor..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 1: Category Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Vendor Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={categorySelection?.categoryId || ''}
                  onValueChange={(value) => {
                    const category = availableCategories.find((c) => c.id === value)
                    if (category) {
                      setCategorySelection({ categoryId: value, categoryName: category.name })
                    }
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {categorySelection && (
                <div className="text-sm text-muted-foreground">
                  Selected: {categorySelection.categoryName}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Due Diligence */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {dueDiligenceAnswers.length > 0 ? (
                dueDiligenceAnswers.map((answer, index) => (
                  <div key={answer.questionId} className="space-y-2">
                    <Label htmlFor={`dd-${index}`}>
                      {answer.question}
                      {answer.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <Textarea
                      id={`dd-${index}`}
                      value={answer.answer}
                      onChange={(e) => updateDueDiligenceAnswer(index, e.target.value)}
                      placeholder="Enter your answer..."
                      rows={3}
                      required={answer.required}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {categorySelection
                    ? 'Loading due diligence questions...'
                    : 'Please select a category first'}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Document Upload */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Upload Documents</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag and drop files here, or click to browse
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'general')}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      Browse Files
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file)
                  </p>
                </div>
              </div>
              {documents.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Documents</Label>
                  <div className="space-y-2">
                    {documents.map((doc, index) => (
                      <Card key={index}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Type: {doc.type} • {(doc.file.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDocument(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Contract Selection */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contract">
                  Contract Template <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={contractSelection?.contractId || ''}
                  onValueChange={(value) => {
                    const contract = availableContracts.find((c) => c.id === value)
                    if (contract) {
                      setContractSelection({ contractId: value, contractName: contract.name })
                    }
                  }}
                >
                  <SelectTrigger id="contract">
                    <SelectValue placeholder="Select a contract template" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableContracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {contractSelection && (
                <div className="text-sm text-muted-foreground">
                  Selected: {contractSelection.contractName}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Vendor Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><strong>Name:</strong> {vendorDetails.name}</div>
                  <div><strong>Email:</strong> {vendorDetails.email}</div>
                  {vendorDetails.phone && <div><strong>Phone:</strong> {vendorDetails.phone}</div>}
                  {vendorDetails.website && <div><strong>Website:</strong> {vendorDetails.website}</div>}
                  {vendorDetails.address && <div><strong>Address:</strong> {vendorDetails.address}</div>}
                  {vendorDetails.taxId && <div><strong>Tax ID:</strong> {vendorDetails.taxId}</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Category</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {categorySelection?.categoryName || 'Not selected'}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Due Diligence Answers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dueDiligenceAnswers.map((answer) => (
                    <div key={answer.questionId}>
                      <strong>{answer.question}</strong>
                      <p className="text-muted-foreground">{answer.answer || 'Not answered'}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Documents ({documents.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {documents.length > 0 ? (
                    documents.map((doc, index) => (
                      <div key={index}>{doc.name}</div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No documents uploaded</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Contract</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {contractSelection?.contractName || 'Not selected'}
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
            'Submitting...'
          ) : currentStep === STEPS.length - 1 ? (
            'Submit Onboarding'
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

