"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Shield,
  CheckCircle,
  XCircle,
  Download,
  Share2,
  QrCode,
  Copy,
  MapPin,
  FileText,
  Clock,
  GraduationCap,
  Briefcase,
  Award,
  Calendar,
  Verified,
  AlertTriangle,
  ThumbsUp,
  Star,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { QRCodeDisplay } from "@/components/QRCodeDisplay"
import ClaimPublicationDialog from "../../components/ClaimPublicationDialog"
import HeaderBadges from "../../components/HeaderBadges"
import { NPIFreshnessBadge } from "@/components/NPIFreshnessBadge"

interface ClinicianProfile {
  npi: string
  name: string
  specialty: string
  location: string
  address: string
  npiType: string
  taxonomyCode: string
  taxonomyDescription: string
  lastSynced?: string
  verificationScore: number
  education: Array<{
    degree: string
    institution: string
    year: string
    details?: string
    verified: boolean
  }>
  experience: Array<{
    position: string
    organization: string
    startDate: string
    endDate?: string
    description?: string
    verified: boolean
  }>
  licenses: Array<{
    state: string
    number: string
    status: "active" | "expired" | "expiring_soon"
    expiration: string
    verified: boolean
  }>
  certifications: Array<{
    name: string
    issuer: string
    issueDate: string
    expirationDate?: string
    credentialId?: string
    verified: boolean
  }>
  publications?: Array<{
    pmid: string
    title: string
    journal: string
    year: string
    authors: string
    verified: boolean
    provenanceId?: string
  }>
}

export default function ProfilePage() {
  const searchParams = useSearchParams()
  const profileId = searchParams.get("id")
  const [profile, setProfile] = useState<ClinicianProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const { toast } = useToast()

  // Endorsements state
  const [endorsements, setEndorsements] = useState<any[]>([])
  const [averageRating, setAverageRating] = useState(0)

  useEffect(() => {
    fetchProfileData()
  }, [profileId])

  const fetchProfileData = async () => {
    setLoading(true)
    try {
      // Mock comprehensive profile data with verification indicators
      const mockProfile: ClinicianProfile = {
        npi: profileId || "1234567890",
        name: "Dr. Sarah Johnson",
        specialty: "Internal Medicine",
        location: "San Francisco, CA",
        address: "123 Medical Plaza, San Francisco, CA 94102",
        npiType: "Individual",
        taxonomyCode: "207R00000X",
        taxonomyDescription: "Internal Medicine",
        lastSynced: "2024-01-15T10:30:00Z",
        verificationScore: 95,
        education: [
          {
            degree: "Doctor of Medicine (MD)",
            institution: "Stanford University School of Medicine",
            year: "2010",
            details: "Magna Cum Laude, Alpha Omega Alpha Honor Society",
            verified: true,
          },
          {
            degree: "Bachelor of Science in Biology",
            institution: "University of California, Berkeley",
            year: "2006",
            details: "Summa Cum Laude, Phi Beta Kappa",
            verified: true,
          },
        ],
        experience: [
          {
            position: "Attending Physician, Internal Medicine",
            organization: "UCSF Medical Center",
            startDate: "2014-07-01",
            description: "Primary care and hospital medicine, supervising residents and medical students",
            verified: true,
          },
          {
            position: "Chief Resident, Internal Medicine",
            organization: "UCSF Medical Center",
            startDate: "2013-07-01",
            endDate: "2014-06-30",
            description: "Leadership role overseeing resident education and clinical operations",
            verified: true,
          },
          {
            position: "Internal Medicine Resident",
            organization: "UCSF Medical Center",
            startDate: "2010-07-01",
            endDate: "2013-06-30",
            description: "Three-year residency training in internal medicine",
            verified: true,
          },
        ],
        licenses: [
          {
            state: "California",
            number: "A12345",
            status: "active",
            expiration: "2025-12-31",
            verified: true,
          },
          {
            state: "Nevada",
            number: "NV98765",
            status: "expiring_soon",
            expiration: "2024-03-15",
            verified: true,
          },
          {
            state: "Arizona",
            number: "AZ54321",
            status: "expired",
            expiration: "2023-11-30",
            verified: false,
          },
        ],
        certifications: [
          {
            name: "Board Certification in Internal Medicine",
            issuer: "American Board of Internal Medicine",
            issueDate: "2014-01-15",
            expirationDate: "2024-12-31",
            credentialId: "ABIM-12345",
            verified: true,
          },
          {
            name: "Advanced Cardiac Life Support (ACLS)",
            issuer: "American Heart Association",
            issueDate: "2023-06-01",
            expirationDate: "2025-06-01",
            credentialId: "AHA-ACLS-67890",
            verified: true,
          },
          {
            name: "Basic Life Support (BLS)",
            issuer: "American Heart Association",
            issueDate: "2023-06-01",
            expirationDate: "2025-06-01",
            credentialId: "AHA-BLS-54321",
            verified: true,
          },
        ],
        publications: [
          {
            pmid: "12345678",
            title: "Advances in Cardiovascular Medicine: A Systematic Review",
            journal: "Journal of Internal Medicine",
            year: "2023",
            authors: "Johnson SL, Smith A, Lee K",
            verified: true,
            provenanceId: "prov_1234567890",
          },
        ],
      }

      setProfile(mockProfile)
      fetchEndorsements(mockProfile.npi)
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEndorsements = async (npi: string) => {
    try {
      const res = await fetch(`/api/peer/${npi}`)
      if (res.ok) {
        const data = await res.json()
        setEndorsements(data)
        if (data.length > 0) {
          const avg = data.reduce((acc: number, curr: any) => acc + curr.rating, 0) / data.length
          setAverageRating(avg)
        }
      }
    } catch (err) {
      console.error("Failed to fetch endorsements", err)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      // Mock PDF generation
      toast({
        title: "PDF Generated",
        description: "Profile PDF has been downloaded",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      })
    }
  }

  const handleShareProfile = async () => {
    try {
      const shareUrl = `${window.location.origin}/profile?id=${profile?.npi}`
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: "Link Copied",
        description: "Profile link copied to clipboard",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy profile link",
        variant: "destructive",
      })
    }
  }

  const getLicenseStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return {
          variant: "default" as const,
          color: "text-green-600",
          bgColor: "bg-green-50",
        }
      case "expiring_soon":
        return {
          variant: "secondary" as const,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
        }
      case "expired":
        return {
          variant: "destructive" as const,
          color: "text-red-600",
          bgColor: "bg-red-50",
        }
      default:
        return {
          variant: "secondary" as const,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
        }
    }
  }

  const getVerificationScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50 border-green-200"
    if (score >= 75) return "text-blue-600 bg-blue-50 border-blue-200"
    if (score >= 60) return "text-orange-600 bg-orange-50 border-orange-200"
    return "text-red-600 bg-red-50 border-red-200"
  }

  const getVerificationScoreIcon = (score: number) => {
    if (score >= 90) return <Verified className="h-4 w-4" />
    if (score >= 75) return <CheckCircle className="h-4 w-4" />
    if (score >= 60) return <AlertTriangle className="h-4 w-4" />
    return <XCircle className="h-4 w-4" />
  }

  if (loading) {
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
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
                Analytics
              </Link>
            </nav>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-4" />
            <Skeleton className="h-6 w-96 mb-6" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>

            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Profile Not Found</CardTitle>
            <CardDescription className="text-center">The requested profile could not be found.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button>Return Home</Button>
            </Link>
          </CardContent>
        </Card>
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
            <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Top Summary */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{profile.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-lg text-gray-600 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span>{profile.specialty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>{profile.location}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 px-3 py-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  NPI Verified
                </Badge>
                <NPIFreshnessBadge lastSynced={profile.lastSynced} />
                <Badge
                  variant="outline"
                  className={`px-3 py-1 ${getVerificationScoreColor(profile.verificationScore)}`}
                >
                  {getVerificationScoreIcon(profile.verificationScore)}
                  <span className="ml-1">Verification Score: {profile.verificationScore}%</span>
                </Badge>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1">
                  <Shield className="h-3 w-3 mr-1" />
                  Blockchain Secured
                </Badge>
              </div>
              {/* Behavioral Health Header Badges - PSYPACT & Counseling Compact */}
              <div className="mt-3">
                <HeaderBadges npi={profile.npi} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handleShareProfile} variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share Link
              </Button>
              <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <QrCode className="h-4 w-4 mr-2" />
                    Show QR
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Profile QR Code</DialogTitle>
                    <DialogDescription>Share this verified profile with the QR code</DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center space-y-4">
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-2">
                      <QRCodeDisplay
                        data={`${window.location.origin}/profile?id=${profile.npi}`}
                        size={192}
                        alt="Profile QR Code"
                      />
                    </div>
                    <Button onClick={() => handleShareProfile()} className="w-full">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Profile Link
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Expandable Sections */}
        <div className="space-y-6">
          <Accordion type="multiple" defaultValue={["endorsements", "education", "experience"]} className="space-y-4">
            {/* Endorsements Section */}
            <AccordionItem value="endorsements">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <ThumbsUp className="h-6 w-6 text-blue-600" />
                    <div className="text-left">
                      <CardTitle className="text-lg">Peer Endorsements</CardTitle>
                      <CardDescription>Trusted endorsements from colleagues</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    {endorsements.length > 0 ? (
                      <>
                        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 p-4 bg-blue-50 rounded-lg">
                           <div className="text-center">
                              <div className="text-3xl font-bold text-blue-900">{averageRating.toFixed(1)}</div>
                              <div className="flex gap-1 justify-center">
                                {[1,2,3,4,5].map(star => (
                                   <Star key={star} className={`w-4 h-4 ${star <= Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                ))}
                              </div>
                              <div className="text-xs text-blue-700 mt-1">{endorsements.length} reviews</div>
                           </div>
                           <div className="hidden sm:block h-12 w-px bg-blue-200"></div>
                           <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                              <div className="text-sm text-center sm:text-left">
                                <span className="font-semibold">Skill:</span> {endorsements.filter(e => e.endorsement === 'skill').length}
                              </div>
                              <div className="text-sm text-center sm:text-left">
                                <span className="font-semibold">Experience:</span> {endorsements.filter(e => e.endorsement === 'experience').length}
                              </div>
                              <div className="text-sm text-center sm:text-left">
                                <span className="font-semibold">Professionalism:</span> {endorsements.filter(e => e.endorsement === 'professionalism').length}
                              </div>
                           </div>
                        </div>

                        <div className="space-y-4">
                          {endorsements.map((endorsement) => (
                             <div key={endorsement.id} className="border-b pb-4 last:border-0">
                                <div className="flex justify-between items-start">
                                   <div>
                                      <div className="font-semibold capitalize text-gray-900">{endorsement.endorsement}</div>
                                      <div className="text-xs text-gray-500">{new Date(endorsement.createdAt).toLocaleDateString()}</div>
                                   </div>
                                   <div className="flex gap-0.5">
                                      {[1,2,3,4,5].map(star => (
                                        <Star key={star} className={`w-3 h-3 ${star <= endorsement.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                      ))}
                                   </div>
                                </div>
                                {endorsement.comment && (
                                    <div className="mt-2 text-gray-600 text-sm bg-gray-50 p-2 rounded italic">
                                       "{endorsement.comment}"
                                    </div>
                                )}
                             </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <ThumbsUp className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No endorsements yet</p>
                      </div>
                    )}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Education Section */}
            <AccordionItem value="education">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-6 w-6 text-blue-600" />
                    <div className="text-left">
                      <CardTitle className="text-lg">Education</CardTitle>
                      <CardDescription>Academic background and degrees</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {profile.education.map((edu, index) => (
                        <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{edu.degree}</h4>
                                {edu.verified && (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 border-green-200 text-xs"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <p className="text-gray-600">{edu.institution}</p>
                              {edu.details && <p className="text-sm text-gray-500 mt-1">{edu.details}</p>}
                            </div>
                            <Badge variant="outline" className="self-start sm:self-center">
                              {edu.year}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Experience Section */}
            <AccordionItem value="experience">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-6 w-6 text-purple-600" />
                    <div className="text-left">
                      <CardTitle className="text-lg">Experience</CardTitle>
                      <CardDescription>Professional work history</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {profile.experience.map((exp, index) => (
                        <div key={index} className="border-l-4 border-purple-200 pl-4 py-2">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{exp.position}</h4>
                                {exp.verified && (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 border-green-200 text-xs"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <p className="text-gray-600">{exp.organization}</p>
                              {exp.description && <p className="text-sm text-gray-500 mt-2">{exp.description}</p>}
                            </div>
                            <div className="text-sm text-gray-500 sm:text-right">
                              <div>{new Date(exp.startDate).toLocaleDateString()}</div>
                              <div>to</div>
                              <div>{exp.endDate ? new Date(exp.endDate).toLocaleDateString() : "Present"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Licenses Section */}
            <AccordionItem value="licenses">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-green-600" />
                    <div className="text-left">
                      <CardTitle className="text-lg">Licenses</CardTitle>
                      <CardDescription>State medical licenses and status</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {profile.licenses.map((license, index) => {
                        const config = getLicenseStatusConfig(license.status)
                        return (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-4 border rounded-lg ${config.bgColor}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{license.state}</span>
                                <Badge variant={config.variant} className="text-xs">
                                  {license.status.replace("_", " ")}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div>License #{license.number}</div>
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Expires: {new Date(license.expiration).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    {license.verified ? (
                                      <CheckCircle className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-red-600" />
                                    )}
                                    {license.verified ? "Verified" : "Unverified"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Certifications Section */}
            <AccordionItem value="certifications">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Award className="h-6 w-6 text-orange-600" />
                    <div className="text-left">
                      <CardTitle className="text-lg">Certifications</CardTitle>
                      <CardDescription>Professional certifications and credentials</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {profile.certifications.map((cert, index) => (
                        <div key={index} className="border-l-4 border-orange-200 pl-4 py-2">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                                {cert.verified && (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 border-green-200 text-xs"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <p className="text-gray-600">{cert.issuer}</p>
                              {cert.credentialId && (
                                <p className="text-xs text-gray-500 font-mono mt-1">ID: {cert.credentialId}</p>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 sm:text-right">
                              <div>Issued: {new Date(cert.issueDate).toLocaleDateString()}</div>
                              {cert.expirationDate && (
                                <div>Expires: {new Date(cert.expirationDate).toLocaleDateString()}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            {/* Publications Section */}
            <AccordionItem value="publications">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-6 w-6 text-indigo-600" />
                    <div className="text-left flex-1">
                      <CardTitle className="text-lg">Publications</CardTitle>
                      <CardDescription>Peer-reviewed publications and research</CardDescription>
                    </div>
                    <ClaimPublicationDialog onClaimed={fetchProfileData} />
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    {profile.publications && profile.publications.length > 0 ? (
                      <div className="space-y-4">
                        {profile.publications.map((pub, index) => (
                          <div key={index} className="border-l-4 border-indigo-200 pl-4 py-2">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{pub.title}</h4>
                                    {pub.verified && (
                                      <Badge
                                        variant="outline"
                                        className="bg-green-50 text-green-700 border-green-200 text-xs"
                                      >
                                        <Verified className="h-3 w-3 mr-1" />
                                        Verified
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">{pub.journal}</p>
                                  <p className="text-xs text-gray-500 mt-1">{pub.authors}</p>
                                </div>
                                <Badge variant="outline" className="self-start">
                                  {pub.year}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="font-mono">PMID: {pub.pmid}</span>
                                {pub.provenanceId && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                        View Provenance
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Publication Provenance</DialogTitle>
                                        <DialogDescription>Verification trail for this publication claim</DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-2">
                                        <div className="text-sm">
                                          <span className="font-semibold">Provenance ID:</span>
                                          <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                                            {pub.provenanceId}
                                          </code>
                                        </div>
                                        <div className="text-sm">
                                          <span className="font-semibold">PubMed ID:</span>
                                          <span className="ml-2">{pub.pmid}</span>
                                        </div>
                                        <div className="text-sm">
                                          <span className="font-semibold">Status:</span>
                                          <Badge className="ml-2 bg-green-100 text-green-800">Verified</Badge>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No publications claimed yet</p>
                        <p className="text-xs mt-1">Use the &quot;Claim Publication&quot; button to add your research</p>
                      </div>
                    )}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  )
}














