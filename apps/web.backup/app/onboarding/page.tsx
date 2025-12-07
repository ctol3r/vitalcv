"use client"

import type { Viewport } from "next"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0B' },
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
  width: 'device-width',
  initialScale: 1,
}
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, User, CheckCircle, Loader2, Shield, AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, Camera, CreditCard } from "lucide-react"
import Link from "next/link"
import { AuthGuard } from "@/components/auth-guard"
import { encrypt } from "@/app/lib/crypto/encryption"

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
  const searchParams = useSearchParams()

  // Step management
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4

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
  const [allowManualEntry, setAllowManualEntry] = useState(false)
  const [npiTimeout, setNpiTimeout] = useState(false)
  const [npiFromNPPES, setNpiFromNPPES] = useState(false)
  const [manualNpiEntry, setManualNpiEntry] = useState(false)
  const [manualName, setManualName] = useState("")
  const [manualCredentials, setManualCredentials] = useState("")
  const [manualTaxonomy, setManualTaxonomy] = useState("")

  // Step 3: Identity Verification
  const [identityFiles, setIdentityFiles] = useState<{selfie: File|null, doc: File|null}>({selfie: null, doc: null})
  const [identityResult, setIdentityResult] = useState<{matchScore: number, thresholdCheck: string}|null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)
  const [identityError, setIdentityError] = useState<string|null>(null)

  // Step 4: Review
  const [finalLoading, setFinalLoading] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [confirmPassphrase, setConfirmPassphrase] = useState("")

  // LinkedIn OAuth callback handling
  useEffect(() => {
    const liConnected = searchParams?.get('li')
    const name = searchParams?.get('name')
    const email = searchParams?.get('email')

    if (liConnected === '1' && name) {
      toast({
        title: 'LinkedIn Connected',
        description: `Welcome ${decodeURIComponent(name)}! Your profile has been linked.`,
      })

      // Pre-fill CV data if available
      if (email) {
        setCvData((prev) => ({
          ...prev,
          personalInfo: {
            ...prev?.personalInfo,
            name: decodeURIComponent(name || ''),
            email: decodeURIComponent(email || ''),
          },
        }))
      }

      // Clean URL
      router.replace('/onboarding', { scroll: false })
    }
  }, [searchParams, router, toast])

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
    setNpiTimeout(false)
    setNpiFromNPPES(false)

    const timeoutTimer = setTimeout(() => {
      setNpiTimeout(true)
    }, 10000)

    try {
      clearTimeout(timeoutTimer)
      const response = await fetch("/api/clinician/npi-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ npi: npi.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()

        if (errorData.allowManualEntry) {
          setAllowManualEntry(true)
          setNpiError(errorData.error + " - You can proceed with manual entry.")
        } else {
          throw new Error(errorData.error || `NPI sync failed: ${response.status}`)
        }

        toast({
          title: "NPI Lookup Timeout",
          description: "NPI lookup timed out. You can enter data manually or try again.",
          variant: "destructive",
        })
        return
      }

      const data = await response.json()
      setNpiData(data.npiData)
      setAllowManualEntry(false)
      setNpiFromNPPES(true)
      setNpiTimeout(false)

      toast({
        title: "NPI Synced Successfully",
        description: "Your NPI data has been retrieved and verified.",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync NPI. Please try again."
      setNpiError(errorMessage)
      setAllowManualEntry(true)

      toast({
        title: "NPI Sync Failed",
        description: errorMessage + " - You can enter data manually.",
        variant: "destructive",
      })
    } finally {
      setNpiLoading(false)
    }
  }

  const handleIdentityCheck = async () => {
    if (!identityFiles.selfie || !identityFiles.doc) return

    setIdentityLoading(true)
    setIdentityError(null)

    try {
      const formData = new FormData()
      formData.append('selfie', identityFiles.selfie)
      formData.append('documentPhoto', identityFiles.doc)

      const response = await fetch('/api/identity/face-match', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Face match verification failed')
      }

      const data = await response.json()
      setIdentityResult(data)

      if (data.thresholdCheck === 'pass') {
        toast({
          title: "Identity Verified",
          description: `Match Score: ${(data.matchScore * 100).toFixed(1)}%`,
        })
      } else {
        toast({
          title: "Verification Failed",
          description: "Face match score too low. Please try again with clearer photos.",
          variant: "destructive"
        })
      }
    } catch (err: any) {
      setIdentityError(err.message)
      toast({
        title: "Error",
        description: "Failed to verify identity. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIdentityLoading(false)
    }
  }

  const handleFinish = async () => {
    if (!passphrase || passphrase.length < 8) {
      toast({
        title: "Weak Passphrase",
        description: "Passphrase must be at least 8 characters long.",
        variant: "destructive",
      })
      return
    }

    if (passphrase !== confirmPassphrase) {
      toast({
        title: "Passphrase Mismatch",
        description: "Please ensure your passphrases match.",
        variant: "destructive",
      })
      return
    }

    setFinalLoading(true)

    try {
      const profileData = {
        cvData,
        npiData,
        updatedAt: new Date().toISOString(),
      }

      // Encrypt profile data
      const encrypted = await encrypt(profileData, passphrase)

      // Submit encrypted data
      const response = await fetch("/api/claim/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          npi: npiData?.npi,
          encryptedData: encrypted,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save encrypted profile")
      }

      toast({
        title: "Onboarding Complete!",
        description: "Your profile has been encrypted and saved. Redirecting...",
      })

      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (err) {
      console.error(err)
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
  const canProceedFromStep3 = identityResult?.thresholdCheck === 'pass'
  const canFinish = canProceedFromStep1 && canProceedFromStep2 && canProceedFromStep3

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
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          Your NPI is a unique 10-digit identifier for healthcare providers
                        </p>
                        {npiTimeout && npiLoading && (
                          <Alert variant="default" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              NPI lookup is taking longer than expected (10s+ timeout). You can continue waiting or enter data manually below.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>

                    {npiError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {npiError}
                          {allowManualEntry && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                setManualNpiEntry(true)
                                setNpiError(null)
                              }}
                            >
                              Enter Data Manually
                            </Button>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {manualNpiEntry && !npiData && (
                      <div className="space-y-4 border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                        <h4 className="font-semibold text-blue-900">Manual NPI Entry</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="manual-name">Full Name *</Label>
                            <Input
                              id="manual-name"
                              placeholder="Dr. John Smith"
                              value={manualName}
                              onChange={(e) => setManualName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="manual-credentials">Credentials *</Label>
                            <Input
                              id="manual-credentials"
                              placeholder="MD, DO, NP, etc."
                              value={manualCredentials}
                              onChange={(e) => setManualCredentials(e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor="manual-taxonomy">Primary Taxonomy *</Label>
                            <Input
                              id="manual-taxonomy"
                              placeholder="207R00000X - Internal Medicine"
                              value={manualTaxonomy}
                              onChange={(e) => setManualTaxonomy(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            setNpiData({
                              npi: npi,
                              name: manualName,
                              credentials: manualCredentials,
                              primaryTaxonomy: manualTaxonomy,
                              status: "Active",
                              enumerationDate: new Date().toISOString(),
                              lastUpdated: new Date().toISOString(),
                              practiceAddress: {
                                address1: "",
                                city: "",
                                state: "",
                                postalCode: "",
                                countryCode: "US",
                              },
                            })
                            setManualNpiEntry(false)
                            toast({
                              title: "Manual Entry Saved",
                              description: "Your NPI information has been recorded.",
                            })
                          }}
                          disabled={!manualName || !manualCredentials || !manualTaxonomy}
                        >
                          Save Manual Entry
                        </Button>
                      </div>
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
                          <div className="flex items-center gap-2">
                            {npiFromNPPES && (
                              <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
                                <BadgeCheck className="h-3 w-3 mr-1" />
                                Data from NPPES
                              </Badge>
                            )}
                            <span className="text-sm text-gray-500">Status: {npiData.status}</span>
                          </div>
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

            {/* Step 3: Identity Verification */}
            {currentStep === 3 && (
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <span>Confirm Your Identity</span>
                  </CardTitle>
                  <CardDescription>Upload a selfie and your photo ID for verification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Selfie Upload */}
                    <div className="space-y-4">
                      <Label>Selfie Photo</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setIdentityFiles(prev => ({ ...prev, selfie: file }))
                          }}
                          className="hidden"
                          id="selfie-upload"
                        />
                        <label htmlFor="selfie-upload" className="cursor-pointer block">
                          {identityFiles.selfie ? (
                            <div className="space-y-2">
                              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                              <p className="text-sm font-medium">{identityFiles.selfie.name}</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Camera className="h-8 w-8 text-gray-400 mx-auto" />
                              <p className="text-sm text-gray-600">Click to upload selfie</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Document Upload */}
                    <div className="space-y-4">
                      <Label>Government ID</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setIdentityFiles(prev => ({ ...prev, doc: file }))
                          }}
                          className="hidden"
                          id="doc-upload"
                        />
                        <label htmlFor="doc-upload" className="cursor-pointer block">
                          {identityFiles.doc ? (
                            <div className="space-y-2">
                              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                              <p className="text-sm font-medium">{identityFiles.doc.name}</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <CreditCard className="h-8 w-8 text-gray-400 mx-auto" />
                              <p className="text-sm text-gray-600">Click to upload ID</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={handleIdentityCheck}
                      disabled={!identityFiles.selfie || !identityFiles.doc || identityLoading}
                      className="w-full md:w-auto"
                    >
                      {identityLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Identity"
                      )}
                    </Button>
                  </div>

                  {identityResult && (
                    <div className={`p-4 rounded-lg border ${identityResult.thresholdCheck === 'pass' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center space-x-3">
                        {identityResult.thresholdCheck === 'pass' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <p className={`font-medium ${identityResult.thresholdCheck === 'pass' ? 'text-green-900' : 'text-red-900'}`}>
                            {identityResult.thresholdCheck === 'pass' ? 'Verification Successful' : 'Verification Failed'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Match Confidence: {(identityResult.matchScore * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between mt-6">
                    <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex items-center space-x-2">
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back</span>
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(4)}
                      disabled={!canProceedFromStep3}
                      className="flex items-center space-x-2"
                    >
                      <span>Next: Review</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Review & Confirm */}
            {currentStep === 4 && (
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

                  {/* Encryption Setup */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        Secure Your Data
                      </h3>
                      <p className="text-sm text-gray-600">
                        Set a passphrase to encrypt your personal information.
                        VitalCV cannot access your data without this key.
                        <span className="font-semibold text-red-600 ml-1">Do not lose this passphrase!</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="space-y-2">
                        <Label htmlFor="passphrase">Create Passphrase</Label>
                        <Input
                          id="passphrase"
                          type="password"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          placeholder="At least 8 characters"
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-passphrase">Confirm Passphrase</Label>
                        <Input
                          id="confirm-passphrase"
                          type="password"
                          value={confirmPassphrase}
                          onChange={(e) => setConfirmPassphrase(e.target.value)}
                          placeholder="Re-enter passphrase"
                          className="bg-white"
                        />
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
                      onClick={() => setCurrentStep(3)}
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
