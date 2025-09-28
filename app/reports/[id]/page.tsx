"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Share2, Archive, Shield, CheckCircle, AlertTriangle, Clock, FileText, Loader2 } from "lucide-react"
import { ReportSummary } from "@/components/ReportSummary"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface ReportData {
  id: string
  timestamp: string
  clearedCredentials: Array<{
    id: string
    type: string
    issuer: string
    status: string
  }>
  pendingCredentials: Array<{
    id: string
    type: string
    issuer: string
    reason: string
  }>
  recommendation: "proceed" | "conditional" | "hold"
  confidenceScore: number
}

export default function ReportPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fhirLoading, setFhirLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Simulate API call to fetch report
    const fetchReport = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const mockReport: ReportData = {
        id: params.id,
        timestamp: new Date().toISOString(),
        clearedCredentials: [
          {
            id: "CRED-12345",
            type: "Medical License",
            issuer: "California Medical Board",
            status: "Valid",
          },
          {
            id: "CRED-67890",
            type: "Board Certification",
            issuer: "American Board of Internal Medicine",
            status: "Valid",
          },
        ],
        pendingCredentials: [
          {
            id: "CRED-11111",
            type: "DEA Registration",
            issuer: "Drug Enforcement Administration",
            reason: "Awaiting renewal verification",
          },
        ],
        recommendation: params.id.includes("hold")
          ? "hold"
          : params.id.includes("conditional")
            ? "conditional"
            : "proceed",
        confidenceScore: 92,
      }

      setReport(mockReport)
      setLoading(false)
    }

    fetchReport()
  }, [params.id])

  const downloadFHIRBundle = async () => {
    if (!report) return

    setFhirLoading(true)
    try {
      const response = await fetch(`/api/reports/${report.id}/fhir-bundle`, {
        method: "GET",
        headers: {
          Accept: "application/fhir+json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to download FHIR bundle: ${response.status} ${response.statusText}`)
      }

      // Get the blob data
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `fhir-bundle-${report.id}.json`
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download Complete",
        description: "FHIR bundle has been downloaded successfully",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to download FHIR bundle"
      toast({
        title: "Download Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setFhirLoading(false)
    }
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case "proceed":
        return "bg-green-100 text-green-800"
      case "conditional":
        return "bg-yellow-100 text-yellow-800"
      case "hold":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case "proceed":
        return <CheckCircle className="h-5 w-5" />
      case "conditional":
        return <AlertTriangle className="h-5 w-5" />
      case "hold":
        return <Clock className="h-5 w-5" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertDescription>Report not found</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Report Header */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Verification Report</h1>
                <p className="text-gray-600">Report ID: {report.id}</p>
                <p className="text-sm text-gray-500">Generated: {new Date(report.timestamp).toLocaleString()}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4 md:mt-0">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm" onClick={downloadFHIRBundle} disabled={fhirLoading}>
                  {fhirLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Download FHIR Bundle
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              </div>
            </div>

            {/* Recommendation Badge */}
            <div className="flex items-center gap-4">
              <Badge className={`${getRecommendationColor(report.recommendation)} px-4 py-2 text-sm font-semibold`}>
                {getRecommendationIcon(report.recommendation)}
                <span className="ml-2 capitalize">{report.recommendation}</span>
              </Badge>
              <div className="text-sm text-gray-600">
                Confidence Score: <span className="font-semibold">{report.confidenceScore}%</span>
              </div>
            </div>
          </div>

          {/* FHIR Bundle Info Card */}
          <Card className="mb-6 bg-blue-50/50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="h-5 w-5" />
                FHIR Bundle Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800 mb-3">
                This report includes a FHIR-compliant bundle containing structured healthcare credential data. The
                bundle includes practitioner information, qualifications, and verification status in standard FHIR
                format.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="bg-white/50">
                  FHIR R4
                </Badge>
                <Badge variant="outline" className="bg-white/50">
                  Practitioner Resource
                </Badge>
                <Badge variant="outline" className="bg-white/50">
                  PractitionerRole Resource
                </Badge>
                <Badge variant="outline" className="bg-white/50">
                  Qualification Resource
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Report Sections */}
          <div className="space-y-6">
            <ReportSummary title="Cleared Credentials" type="cleared" credentials={report.clearedCredentials} />

            {report.pendingCredentials.length > 0 && (
              <ReportSummary title="Pending Credentials" type="pending" credentials={report.pendingCredentials} />
            )}

            {/* Recommendation Details */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getRecommendationIcon(report.recommendation)}
                  Recommendation Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.recommendation === "proceed" && (
                  <div className="text-green-700">
                    <p className="font-semibold mb-2">✅ Proceed with Employment</p>
                    <p>
                      All required credentials have been verified and are in good standing. The candidate meets all
                      verification requirements.
                    </p>
                  </div>
                )}
                {report.recommendation === "conditional" && (
                  <div className="text-yellow-700">
                    <p className="font-semibold mb-2">⚠️ Conditional Employment</p>
                    <p>
                      Most credentials are verified, but some items require attention. Employment may proceed with
                      conditions or pending resolution of outstanding items.
                    </p>
                  </div>
                )}
                {report.recommendation === "hold" && (
                  <div className="text-red-700">
                    <p className="font-semibold mb-2">🛑 Hold Employment</p>
                    <p>
                      Critical verification issues have been identified. Employment should be held until all issues are
                      resolved.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
