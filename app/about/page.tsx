import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Shield,
  Zap,
  Lock,
  CheckCircle,
  Code,
  Book,
  Activity,
  FileText,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

export default function AboutPage() {
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
            <Link href="/api-docs" className="text-gray-600 hover:text-blue-600 transition-colors">
              API Docs
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-6">
              <Shield className="h-16 w-16 text-blue-600" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">About VitalCV</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A next-generation verifiable credentials platform for healthcare professionals, built on open
              standards and designed for trust, privacy, and speed.
            </p>
          </div>

          {/* Core Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <Zap className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Reduce credentialing time from 90+ days to under 10 days with automated verification and
                  real-time status checks
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <Lock className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>Privacy-Preserving</CardTitle>
                <CardDescription>
                  BBS+ signatures and selective disclosure let holders share only what's needed, protecting
                  sensitive health data
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CheckCircle className="h-12 w-12 text-teal-600 mb-4" />
                <CardTitle>Standards-Based</CardTitle>
                <CardDescription>
                  Built on OIDC4VCI, SD-JWT, DCQL, and W3C standards for interoperability with existing
                  healthcare systems
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Technology Stack */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-16">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <Code className="h-6 w-6 text-blue-600" />
                Technology & Standards
              </CardTitle>
              <CardDescription>Built on cutting-edge cryptography and open standards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Protocols & Standards</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>OIDC4VCI:</strong> OpenID for Verifiable Credential Issuance
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>SD-JWT:</strong> Selective Disclosure JSON Web Tokens
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>BBS+:</strong> Privacy-preserving cryptographic signatures
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>DCQL:</strong> Digital Credentials Query Language
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>DID:key:</strong> Decentralized identifiers
                      </span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Technology Stack</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Next.js 14:</strong> React framework with App Router
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>TypeScript:</strong> Type-safe development
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Redis:</strong> Distributed caching and rate limiting
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Docker:</strong> Containerized deployment
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Node.js Crypto:</strong> ES256, ES256K, EdDSA signing
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Features */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-16">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <Activity className="h-6 w-6 text-blue-600" />
                Key Capabilities
              </CardTitle>
              <CardDescription>Comprehensive credential lifecycle management</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 text-blue-900">For Issuers</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Generate credential offers with QR codes and deep links</li>
                    <li>• PKCE-protected token exchange (S256)</li>
                    <li>• Real cryptographic JWT signing (ES256/ES256K/EdDSA)</li>
                    <li>• Comprehensive audit logging (22 event types)</li>
                    <li>• Rate limiting per endpoint</li>
                    <li>• StatusList2021 revocation support</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 text-green-900">For Verifiers</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• DCQL-based selective disclosure verification</li>
                    <li>• BBS+ and Zero-Knowledge proof support</li>
                    <li>• Real-time credential status checks</li>
                    <li>• Nonce-based replay attack prevention</li>
                    <li>• Request ID tracing for audit logs</li>
                    <li>• Localized error messages</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentation Links */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <Card className="bg-blue-50 border-blue-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <Book className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>Documentation</CardTitle>
                <CardDescription>Comprehensive guides for developers and operators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="/api-docs"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium">API Documentation</span>
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/your-org/vitalcv/blob/main/DEPLOYMENT.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium">Deployment Guide</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href="https://github.com/your-org/vitalcv/blob/main/CONTRIBUTING.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium">Contributing Guide</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href="https://github.com/your-org/vitalcv/blob/main/INCIDENTS.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium">Incident Response</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <FileText className="h-8 w-8 text-green-600 mb-2" />
                <CardTitle>Resources</CardTitle>
                <CardDescription>Tools and utilities for working with VitalCV</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="/health"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-green-100 transition-colors"
                >
                  <span className="font-medium">System Health Dashboard</span>
                  <Activity className="h-4 w-4" />
                </Link>
                <Link
                  href="/verify"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-green-100 transition-colors"
                >
                  <span className="font-medium">Verify Credentials</span>
                  <Shield className="h-4 w-4" />
                </Link>
                <Link
                  href="/issuer/offer"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-green-100 transition-colors"
                >
                  <span className="font-medium">Generate Credential Offer</span>
                  <Zap className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/your-org/vitalcv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-green-100 transition-colors"
                >
                  <span className="font-medium">GitHub Repository</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Compliance */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-16">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <Shield className="h-6 w-6 text-blue-600" />
                Security & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">HIPAA Compliant</h3>
                  <p className="text-sm text-gray-600">
                    Comprehensive audit trails, encrypted storage, and access controls meet HIPAA requirements
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">GDPR Ready</h3>
                  <p className="text-sm text-gray-600">
                    Privacy by design with selective disclosure and right-to-be-forgotten support
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">SOC 2 Aligned</h3>
                  <p className="text-sm text-gray-600">
                    Security controls, monitoring, and incident response procedures in place
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call to Action */}
          <div className="text-center bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-lg mb-8 text-blue-100">
              Try our verification demo or explore the API documentation
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link href="/verify">Verify Credentials</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white text-blue-600 hover:bg-blue-50">
                <Link href="/api-docs">View API Docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">© 2025 VitalCV. All rights reserved.</p>
          <p className="text-gray-500 text-sm mt-2">
            Built with Next.js, TypeScript, and open standards
          </p>
        </div>
      </footer>
    </div>
  )
}
