"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, User, CheckCircle, Loader2, Shield, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react"
import Link from "next/link"
import { AuthGuard } from "@/components/auth-guard"

interface CVData {
  personalInfo?: {
    name?: string
    email?: string
    phone?: string
    address?: string
  }
  education?: Array<{
    degree: string
    institution: string
    year: string
    gpa?: string
  }>
  experience?: Array<{
    position: string
    organization: string
    startDate: string
    endDate: string
    description: string
  }>
  licenses?: Array<{
    type: string
    number: string
    state: string
    expirationDate: string
    status: string
  }>
  certifications?: Array<{
    name: string
    organization: string
    date: string
    expirationDate?: string
  }>
}

interface NPIData {
  npi: string
  name: string
  credentials: string
  primaryTaxonomy: string
  practiceAddress: {
    address1: string
    city: string
    state: string
    postalCode: string
    countryCode: string
  }
  enumerationDate: string
  lastUpdated: string
  status: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Step management
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  // Step 1: CV Upload
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvData, setCvData] = useState<CVData | null>(null)
  const [cvLoading, setCvLoading] = useState(false)
  const [cvError, setCvError] = useState<string | null>(null)
  const [showManualEdit, setShowManualEdit] = useState(false)

  // Step 2: NPI Sync
  const [npi, setNpi] = useState("")
  const [npiData, setNpiData] = useState<NPIData | null>(null)
  const [npiLoading, setNpiLoading] = useState(false)
  const [npiError, setNpiError] = useState<string | null>(null)

  // Step 3: Review
  const [finalLoading, setFinalLoading] = useState(false)

  const handleFileUpload = async (file: File) => {
    setCvLoading(true)
    setCvError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload/cv", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Upload failed: ${response.status}`)
      }

      const data = await response.json()
      setCvData(data.parsed)

      toast({
        title: "CV Uploaded Successfully",
        description: "Your CV has been parsed and is ready for review.",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload CV. Please try again."
      setCvError(errorMessage)

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setCvLoading(false)
    }
  }

  const handleNpiSync = async () => {
    if (!npi.trim()) return

    setNpiLoading(true)
    setNpiError(null)

    try {
      const response = await fetch("/api/clinician/npi-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ npi: npi.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `NPI sync failed: ${response.status}`)
      }

      const data = await response.json()
      setNpiData(data.npiData)

      toast({
        title: "NPI Synced Successfully",
        description: "Your NPI data has been retrieved and verified.",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync NPI. Please try again."
      setNpiError(errorMessage)

      toast({
        title: "NPI Sync Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setNpiLoading(false)
    }
  }

  const handleFinish = async () => {
    setFinalLoading(true)

    try {
      // Simulate final processing
      await new Promise((resolve) => setTimeout(resolve, 2000))

      toast({
        title: "Onboarding Complete!",
        description: "Welcome to VitalCV. Redirecting to your dashboard...",
      })

      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (err) {
      toast({
        title: "Setup Failed",
        description: "There was an error completing your setup. Please try again.",
        variant: "destructive",
      })
      setFinalLoading(false)
    }
  }

  const canProceedFromStep1 = cvData !== null
  const canProceedFromStep2 = npiData !== null
  const canFinish = canProceedFromStep1 && canProceedFromStep2

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">VitalCV</span>
            </Link>
            <div className="text-sm text-gray-600">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-3xl font-bold text-gray-900">Get Started with VitalCV</h1>
                <span className="text-sm text-gray-500">{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
              </div>
              <Progress value={(currentStep / totalSteps) * 100} className="h-2" />
            </div>

            {/* Step 1: Upload CV */}
            {currentStep === 1 && (
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="h-6 w-6 text-blue-600" />
                    <span>Upload Your CV</span>
                  </CardTitle>
                  <CardDescription>
                    Upload your CV to automatically extract your professional information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!cvData && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setCvFile(file)
                            handleFileUpload(file)
                          }
                        }}
                        className="hidden"
                        id="cv-upload"
                        disabled={cvLoading}
                      />
                      <label htmlFor="cv-upload" className="cursor-pointer">
                        {cvLoading ? (
                          <div className="space-y-4">
                            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
                            <p className="text-gray-600">Processing your CV...</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                            <div>
                              <p className="text-lg font-medium text-gray-900">Drop your CV here or click to browse</p>
                              <p className="text-sm text-gray-500">Supports PDF, DOC, and DOCX files</p>
                            </div>
                          </div>
                        )}
                      </label>
                    </div>
                  )}

                  {cvError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{cvError}</AlertDescription>
                    </Alert>
                  )}

                  {cvData && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Parsed CV Data</h3>
                        <Button variant="outline" size="sm" onClick={() => setShowManualEdit(!showManualEdit)}>
                          Edit Manually
                        </Button>
                      </div>

                      {showManualEdit ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                              id="name"
                              value={cvData.personalInfo?.name || ""}
                              onChange={(e) =>
                                setCvData({
                                  ...cvData,
                                  personalInfo: { ...cvData.personalInfo, name: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={cvData.personalInfo?.email || ""}
                              onChange={(e) =>
                                setCvData({
                                  ...cvData,
                                  personalInfo: { ...cvData.personalInfo, email: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                              id="phone"
                              value={cvData.personalInfo?.phone || ""}
                              onChange={(e) =>
                                setCvData({
                                  ...cvData,
                                  personalInfo: { ...cvData.personalInfo, phone: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="address">Address</Label>
                            <Input
                              id="address"
                              value={cvData.personalInfo?.address || ""}
                              onChange={(e) =>
                                setCvData({
                                  ...cvData,
                                  personalInfo: { ...cvData.personalInfo, address: e.target.value },
                                })
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div>
                            <strong>Name:</strong> {cvData.personalInfo?.name || "Not specified"}
                          </div>
                          <div>
                            <strong>Email:</strong> {cvData.personalInfo?.email || "Not specified"}
                          </div>
                          <div>
                            <strong>Phone:</strong> {cvData.personalInfo?.phone || "Not specified"}
                          </div>
                          <div>
                            <strong>Address:</strong> {cvData.personalInfo?.address || "Not specified"}
                          </div>
                          {cvData.education && cvData.education.length > 0 && (
                            <div>
                              <strong>Education:</strong>{" "}
                              {cvData.education.map((edu) => `${edu.degree} from ${edu.institution}`).join(", ")}
                            </div>
                          )}
                          {cvData.licenses && cvData.licenses.length > 0 && (
                            <div>
                              <strong>Licenses:</strong>{" "}
                              {cvData.licenses.map((license) => `${license.type} (${license.state})`).join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => setCurrentStep(2)}
                      disabled={!canProceedFromStep1}
                      className="flex items-center space-x-2"
                    >
                      <span>Next: Enter NPI</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Enter NPI */}
            {currentStep === 2 && (
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-6 w-6 text-blue-600" />
                    <span>Enter Your NPI</span>
                  </CardTitle>
                  <CardDescription>Sync your National Provider Identifier to verify your credentials</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="npi">National Provider Identifier (NPI)</Label>
                      <div className="flex space-x-2 mt-1">
                        <Input
                          id="npi"
                          type="text"
                          placeholder="Enter your 10-digit NPI"
                          value={npi}
                          onChange={(e) => setNpi(e.target.value.replace(/\D/g, ""))}
                          maxLength={10}
                          pattern="[0-9]{10}"
                        />
                        <Button onClick={handleNpiSync} disabled={!npi.trim() || npi.length !== 10 || npiLoading}>
                          {npiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sync NPI"}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Your NPI is a unique 10-digit identifier for healthcare providers
                      </p>
                    </div>

                    {npiError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{npiError}</AlertDescription>
                      </Alert>
                    )}

                    {npiLoading && (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    )}

                    {npiData && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">NPI Information</h3>
                          <span className="text-sm text-gray-500">Status: {npiData.status}</span>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div>
                            <strong>NPI:</strong> {npiData.npi}
                          </div>
                          <div>
                            <strong>Name:</strong> {npiData.name}
                          </div>
                          <div>
                            <strong>Credentials:</strong> {npiData.credentials}
                          </div>
                          <div>
                            <strong>Primary Taxonomy:</strong> {npiData.primaryTaxonomy}
                          </div>
                          <div>
                            <strong>Practice Address:</strong>{" "}
                            {`${npiData.practiceAddress.address1}, ${npiData.practiceAddress.city}, ${npiData.practiceAddress.state} ${npiData.practiceAddress.postalCode}`}
                          </div>
                          <div>
                            <strong>Enumeration Date:</strong> {new Date(npiData.enumerationDate).toLocaleDateString()}
                          </div>
                          <div>
                            <strong>Last Updated:</strong> {new Date(npiData.lastUpdated).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex items-center space-x-2">
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back</span>
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(3)}
                      disabled={!canProceedFromStep2}
                      className="flex items-center space-x-2"
                    >
                      <span>Next: Review</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Review & Confirm */}
            {currentStep === 3 && (
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                    <span>Review & Confirm</span>
                  </CardTitle>
                  <CardDescription>Review your information before completing the setup</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* CV Information */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900">CV Information</h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                        <div>
                          <strong>Name:</strong> {cvData?.personalInfo?.name || "Not specified"}
                        </div>
                        <div>
                          <strong>Email:</strong> {cvData?.personalInfo?.email || "Not specified"}
                        </div>
                        <div>
                          <strong>Phone:</strong> {cvData?.personalInfo?.phone || "Not specified"}
                        </div>
                        <div>
                          <strong>Address:</strong> {cvData?.personalInfo?.address || "Not specified"}
                        </div>
                        {cvData?.education && cvData.education.length > 0 && (
                          <div>
                            <strong>Education:</strong> {cvData.education.length} degree(s) found
                          </div>
                        )}
                        {cvData?.licenses && cvData.licenses.length > 0 && (
                          <div>
                            <strong>Licenses:</strong> {cvData.licenses.length} license(s) found
                          </div>
                        )}
                      </div>
                    </div>

                    {/* NPI Information */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900">NPI Information</h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                        <div>
                          <strong>NPI:</strong> {npiData?.npi}
                        </div>
                        <div>
                          <strong>Name:</strong> {npiData?.name}
                        </div>
                        <div>
                          <strong>Credentials:</strong> {npiData?.credentials}
                        </div>
                        <div>
                          <strong>Status:</strong> {npiData?.status}
                        </div>
                        <div>
                          <strong>Primary Taxonomy:</strong> {npiData?.primaryTaxonomy}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your information looks good! Click "Finish" to complete your VitalCV setup and access your
                      dashboard.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      disabled={finalLoading}
                      className="flex items-center space-x-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back</span>
                    </Button>
                    <Button
                      onClick={handleFinish}
                      disabled={!canFinish || finalLoading}
                      className="flex items-center space-x-2"
                    >
                      {finalLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Setting up...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          <span>Finish</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
