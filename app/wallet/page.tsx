"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Shield, Wallet, History } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { RevocationTimeline, type TimelineEvent } from "@/components/RevocationTimeline"
import { AccessLog, type AccessLogEntry } from "@/components/AccessLog"

interface Credential {
  id: string
  type: string
  issuer: string
  status: "active" | "revoked" | "expired"
  issuedDate: string
  expiryDate?: string
}

export default function WalletPage() {
  const [credentials, setCredentials] = useState<Credential[]>([
    {
      id: "CRED-12345",
      type: "Medical License",
      issuer: "California Medical Board",
      status: "active",
      issuedDate: "2023-01-15",
      expiryDate: "2025-01-15",
    },
    {
      id: "CRED-67890",
      type: "Board Certification",
      issuer: "American Board of Internal Medicine",
      status: "active",
      issuedDate: "2023-03-20",
      expiryDate: "2026-03-20",
    },
  ])

  const [selectedCredential, setSelectedCredential] = useState<string | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([
    {
      type: "issued",
      timestamp: "2023-01-15T10:00:00Z",
      auditRef: "AUDIT-001",
      details: "Credential issued by California Medical Board",
    },
    {
      type: "verified",
      timestamp: "2023-06-10T14:30:00Z",
      auditRef: "AUDIT-045",
      details: "Verified by UCSF Medical Center",
    },
    {
      type: "verified",
      timestamp: "2023-12-05T09:15:00Z",
      auditRef: "AUDIT-102",
      details: "Verified by Kaiser Permanente",
    },
  ])

  const [accessLogEntries, setAccessLogEntries] = useState<AccessLogEntry[]>([
    {
      id: "log-001",
      timestamp: "2023-12-05T09:15:00Z",
      credentialId: "CRED-12345",
      verifier: "Kaiser Permanente",
      auditRef: "AUDIT-102",
      status: "valid",
    },
    {
      id: "log-002",
      timestamp: "2023-06-10T14:30:00Z",
      credentialId: "CRED-12345",
      verifier: "UCSF Medical Center",
      auditRef: "AUDIT-045",
      status: "valid",
    },
  ])

  const { toast } = useToast()

  useEffect(() => {
    const stored = localStorage.getItem("vitalcv_access_log")
    if (stored) {
      try {
        const parsedEntries = JSON.parse(stored)
        setAccessLogEntries(parsedEntries)
      } catch (error) {
        console.error("Failed to parse access log:", error)
      }
    }
  }, [])

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { color: "bg-green-100 text-green-800", label: "Active" }
      case "revoked":
        return { color: "bg-red-100 text-red-800", label: "Revoked" }
      case "expired":
        return { color: "bg-yellow-100 text-yellow-800", label: "Expired" }
      default:
        return { color: "bg-gray-100 text-gray-800", label: "Unknown" }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <header className="border-b bg-white/80 backdrop-blur-sm" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6" role="navigation" aria-label="Main navigation">
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/issuer" className="text-gray-600 hover:text-blue-600 transition-colors">
              Issuer
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">My Wallet</h1>
          <p className="text-lg text-gray-600">Manage your verifiable credentials and access history</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                  My Credentials
                </CardTitle>
                <CardDescription>
                  {credentials.length} credential{credentials.length !== 1 ? "s" : ""} in your wallet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {credentials.map((credential) => {
                    const statusConfig = getStatusConfig(credential.status)
                    return (
                      <button
                        key={credential.id}
                        onClick={() => setSelectedCredential(credential.id)}
                        className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                          selectedCredential === credential.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-blue-300"
                        }`}
                        aria-pressed={selectedCredential === credential.id}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg">{credential.type}</h3>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>ID:</strong> <code className="text-xs">{credential.id}</code>
                        </p>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>Issuer:</strong> {credential.issuer}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Issued:</strong> {new Date(credential.issuedDate).toLocaleDateString()}
                          {credential.expiryDate &&
                            ` | Expires: ${new Date(credential.expiryDate).toLocaleDateString()}`}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Tabs defaultValue="timeline" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="access">Access Log</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline">
                <RevocationTimeline
                  credentialId={selectedCredential || "Select a credential"}
                  events={timelineEvents}
                />
              </TabsContent>

              <TabsContent value="access">
                <AccessLog entries={accessLogEntries} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}
