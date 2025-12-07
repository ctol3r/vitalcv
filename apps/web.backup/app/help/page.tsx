import { SupportFAQ } from "@/components/SupportFAQ"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Play, ExternalLink } from "lucide-react"

export default function HelpPage() {
  const guides = [
    {
      title: "Clinician Onboarding Guide",
      description: "Step-by-step instructions for setting up your profile and receiving credentials.",
      href: "/docs/pilot/Clinician-Onboarding-Guide.md",
    },
    {
      title: "Issuer Operations Manual",
      description: "Operational workflows for approving claims and issuing credentials.",
      href: "/docs/pilot/Issuer-Operations-Guide.md",
    },
    {
      title: "Verifier Quick-Start",
      description: "How to scan and verify credentials using the VitalCV platform.",
      href: "/docs/pilot/Verifier-Quickstart.md",
    },
  ]

  const videos = [
    { title: "Intro to VitalCV", href: "#" },
    { title: "How Issuers Approve Claims", href: "#" },
    { title: "How Verifiers Scan Credentials", href: "#" },
  ]

  return (
    <div className="container mx-auto py-10 space-y-10 px-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">
          Documentation, guides, and FAQs to help you get the most out of VitalCV.
        </p>
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-6">Documentation</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Note: These guides are available in the project documentation folder <code>/docs/pilot/</code>.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {guides.map((guide) => (
            <Card key={guide.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {guide.title}
                </CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <a href={guide.href} target="_blank" rel="noopener noreferrer">
                    View Guide <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6">Video Tutorials</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {videos.map((video) => (
            <Card key={video.title} className="bg-muted/50">
              <CardContent className="flex items-center justify-between p-6">
                <span className="font-medium">{video.title}</span>
                <Button size="icon" variant="ghost">
                  <Play className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
        <SupportFAQ />
      </section>
    </div>
  )
}

