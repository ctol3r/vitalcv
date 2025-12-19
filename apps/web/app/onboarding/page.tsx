"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, User, CheckCircle, Loader2, Shield, AlertCircle, ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react"
import Link from "next/link"
import { AuthGuard } from "@/components/auth-guard"
import { IDKitWidget } from "@worldcoin/idkit"
import { setVerifiedHuman } from "@/lib/session"

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
  const [allowManualEntry, setAllowManualEntry] = useState(false)
  const [npiTimeout, setNpiTimeout] = useState(false)
  const [npiFromNPPES, setNpiFromNPPES] = useState(false)
  const [manualNpiEntry, setManualNpiEntry] = useState(false)
  const [manualName, setManualName] = useState("")
  const [manualCredentials, setManualCredentials] = useState("")
  const [manualTaxonomy, setManualTaxonomy] = useState("")

  // Step 3: Review
  const [finalLoading, setFinalLoading] = useState(false)

  // Optional: World ID (Proof-of-Personhood) — authn-only
  const [worldIdConsent, setWorldIdConsent] = useState(false)
  const [worldIdProofJson, setWorldIdProofJson] = useState("")
  const [worldIdLoading, setWorldIdLoading] = useState(false)
  const [worldIdVerified, setWorldIdVerified] = useState(false)
  const [worldIdAuditRef, setWorldIdAuditRef] = useState<string | null>(null)
  const [worldIdError, setWorldIdError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("vitalcv_worldid_verified")
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.verified === true) {
        setWorldIdVerified(true)
        setWorldIdAuditRef(typeof parsed.auditRef === "string" ? parsed.auditRef : null)
        setVerifiedHuman("worldid")
      }
    } catch {
      // ignore
    }
  }, [])

  const handleWorldIdVerify = async (proofBodyOverride?: any) => {
    setWorldIdLoading(true)
    setWorldIdError(null)

    try {
      if (!worldIdConsent) {
        throw new Error("Consent is required to verify with World ID.")
      }
      const proofBody = proofBodyOverride ?? JSON.parse(worldIdProofJson)

      const resp = await fetch("/api/world-id/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proofBody),
      })
      const data = await resp.json().catch(() => ({ error: "Invalid JSON response" }))
      if (!resp.ok) {
        throw new Error(data?.error || `World ID verification failed: ${resp.status}`)
      }

      if (data?.verified !== true) {
        throw new Error(data?.error || "World ID verification did not succeed")
      }

      setWorldIdVerified(true)
      setWorldIdAuditRef(typeof data.auditRef === "string" ? data.auditRef : null)
      setVerifiedHuman("worldid")

      localStorage.setItem(
        "vitalcv_worldid_verified",
        JSON.stringify({ verified: true, auditRef: data.auditRef || null, verifiedAt: new Date().toISOString() }),
      )

      toast({
        title: "Verified Human",
        description: "World ID verification succeeded (optional).",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "World ID verification failed"
      setWorldIdError(msg)
      toast({
        title: "World ID Verification Failed",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setWorldIdLoading(false)
    }
  }

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

                  {/* Optional: World ID verification (authn-only; opt-in) */}
                  <div className="rounded-lg border bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="h-5 w-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Verify with World ID (Optional)</h3>
                      </div>
                      {worldIdVerified ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Verified Human</Badge>
                      ) : (
                        <Badge variant="secondary">Not verified</Badge>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                      This is an optional anti-bot check. VitalCV does not store biometrics, and we only record a
                      hash-only audit event (no PHI).
                    </p>

                    <div className="mt-3 flex items-start gap-2">
                      <input
                        id="worldid-consent"
                        type="checkbox"
                        checked={worldIdConsent}
                        onChange={(e) => setWorldIdConsent(e.target.checked)}
                        className="mt-1"
                      />
                      <Label htmlFor="worldid-consent" className="text-sm text-gray-700">
                        I consent to submit my World ID proof for verification. I understand this is optional and can be
                        skipped.
                      </Label>
                    </div>

                    {!worldIdVerified ? (
                      <div className="mt-3 space-y-3">
                        {process.env.NEXT_PUBLIC_WORLD_ID_APP_ID ? (
                          <IDKitWidget
                            app_id={process.env.NEXT_PUBLIC_WORLD_ID_APP_ID}
                            action={process.env.NEXT_PUBLIC_WORLD_ID_ACTION || "vitalcv-verify"}
                            onSuccess={async (result) => {
                              // Send the proof directly to backend verification (no mocks).
                              await handleWorldIdVerify({
                                ...result,
                                action: process.env.NEXT_PUBLIC_WORLD_ID_ACTION || "vitalcv-verify",
                                // Optional non-PHI signal (NPI is not PHI; still treated carefully)
                                signal: npiData?.npi || undefined,
                                consent: true,
                              })
                            }}
                          >
                            {({ open }) => (
                              <Button onClick={open} disabled={worldIdLoading} className="w-full">
                                {worldIdLoading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying…
                                  </>
                                ) : (
                                  <>
                                    <BadgeCheck className="mr-2 h-4 w-4" />
                                    Verify with World ID
                                  </>
                                )}
                              </Button>
                            )}
                          </IDKitWidget>
                        ) : (
                          <Alert>
                            <AlertDescription>
                              World ID is not configured in this environment. Set{" "}
                              <span className="font-mono">NEXT_PUBLIC_WORLD_ID_APP_ID</span> (web) and{" "}
                              <span className="font-mono">WORLD_ID_APP_ID</span> (api) to enable.
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="space-y-1">
                          <Label htmlFor="worldid-proof" className="text-sm">
                            Paste World ID proof JSON (advanced)
                          </Label>
                          <textarea
                            id="worldid-proof"
                            value={worldIdProofJson}
                            onChange={(e) => setWorldIdProofJson(e.target.value)}
                            placeholder='{"proof":{"merkle_root":"...","nullifier_hash":"...","proof":"..."},"signal":"...","action":"...","app_id":"..."}'
                            className="min-h-[120px] w-full rounded-md border bg-white p-2 font-mono text-xs"
                          />
                        </div>

                        {worldIdError ? (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{worldIdError}</AlertDescription>
                          </Alert>
                        ) : null}

                        <Button
                          onClick={() => handleWorldIdVerify()}
                          disabled={worldIdLoading || !worldIdProofJson.trim()}
                          variant="outline"
                          className="w-full"
                        >
                          {worldIdLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying…
                            </>
                          ) : (
                            <>
                              <BadgeCheck className="mr-2 h-4 w-4" />
                              Verify (pasted proof)
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-gray-700">
                        Verified. Audit ref: <span className="font-mono">{worldIdAuditRef || "—"}</span>
                      </div>
                    )}
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
