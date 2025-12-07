'use client';

/**
 * S72-POST-2C-008: Landing page with call-to-action section
 *
 * Displays 2-3 CTAs (Book a demo, Join pilot, View docs).
 * Links wired and mobile friendly.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Users,
  BookOpen,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge className="mb-4" variant="secondary">
            Now in Demo
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Verified Credentials for
            <br />
            <span className="text-primary">Healthcare Hiring</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Eliminate weeks of credentialing with blockchain-backed, instantly verifiable
            professional credentials. Hire clinicians in days, not months.
          </p>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">7 days</div>
              <div className="text-sm text-muted-foreground">Time-to-hire (down from 90)</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">$499</div>
              <div className="text-sm text-muted-foreground">Cost per hire (down from $2,000)</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-primary">85%</div>
              <div className="text-sm text-muted-foreground">Application completion rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call-to-Action Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Get Started with VitalCV</h2>
            <p className="text-lg text-muted-foreground">
              Choose how you'd like to explore the platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Book a Demo */}
            <Card className="hover:shadow-lg transition-shadow border-2 hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Book a Demo</CardTitle>
                </div>
                <CardDescription>
                  Schedule a 30-minute walkthrough with our team to see VitalCV in action.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Live product demonstration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Q&A with solutions engineer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Customized use case discussion</span>
                  </li>
                </ul>
                <Button asChild className="w-full" size="lg">
                  <Link href="https://calendly.com/vitalcv/demo" target="_blank">
                    Schedule Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Join Pilot */}
            <Card className="hover:shadow-lg transition-shadow border-2 hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Join Pilot</CardTitle>
                </div>
                <CardDescription>
                  Get early access to VitalCV and help shape the future of healthcare
                  credentialing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Early access to new features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Direct feedback channel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Priority support</span>
                  </li>
                </ul>
                <Button asChild variant="outline" className="w-full" size="lg">
                  <Link href="mailto:pilot@vitalcv.com?subject=Pilot Program Interest">
                    Join Pilot Program
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* View Docs */}
            <Card className="hover:shadow-lg transition-shadow border-2 hover:border-primary">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>View Documentation</CardTitle>
                </div>
                <CardDescription>
                  Explore our comprehensive documentation, API guides, and integration resources.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>API documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Integration guides</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Architecture overview</span>
                  </li>
                </ul>
                <Button asChild variant="outline" className="w-full" size="lg">
                  <Link href="/docs" target="_blank">
                    View Docs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-6 py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why VitalCV?</h2>
            <p className="text-lg text-muted-foreground">
              Built for healthcare organizations that need faster, more reliable credentialing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle>13x Faster</CardTitle>
                </div>
                <CardDescription>
                  Reduce credentialing time from 90 days to 7 days with automated verification
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Blockchain-Backed</CardTitle>
                </div>
                <CardDescription>
                  Tamper-proof credentials anchored on blockchain for maximum trust and security
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <CardTitle>Portable Credentials</CardTitle>
                </div>
                <CardDescription>
                  Use the same credentials across all employers—no need to re-verify
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <CardTitle>Standards-Based</CardTitle>
                </div>
                <CardDescription>
                  W3C VC, FHIR, TEFCA compliant—no vendor lock-in
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="container mx-auto px-6 py-12 border-t">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h3 className="text-2xl font-bold">Ready to Transform Your Credentialing Process?</h3>
          <p className="text-muted-foreground">
            Join leading health systems and staffing agencies using VitalCV
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="https://calendly.com/vitalcv/demo" target="_blank">
                Schedule a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/changelog">View Changelog</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

