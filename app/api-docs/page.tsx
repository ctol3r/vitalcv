'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

import 'swagger-ui-react/swagger-ui.css'

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [fallbackMode, setFallbackMode] = useState(false)

  useEffect(() => {
    // Fetch OpenAPI spec
    fetch('/api/openapi.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch OpenAPI spec')
        return res.json()
      })
      .then((data) => setSpec(data))
      .catch((err) => {
        console.error('Error loading OpenAPI spec:', err)
        setError(err.message)
        setFallbackMode(true)
      })
  }, [])

  if (error && fallbackMode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="mb-2 text-4xl font-bold text-gray-900">VitalCV API Documentation</h1>
            <p className="text-lg text-gray-600">
              Comprehensive API reference for VitalCV Verifiable Credentials platform
            </p>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 mb-8">
            <h2 className="mb-2 text-lg font-semibold text-yellow-900">
              Fallback Documentation Mode
            </h2>
            <p className="text-sm text-yellow-800">
              Unable to load interactive API documentation. Error: {error}
            </p>
          </div>

          <div className="space-y-8">
            {/* Manual fallback documentation */}
            <section>
              <h2 className="mb-4 text-2xl font-bold text-gray-900">OIDC4VCI Endpoints</h2>
              <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      POST
                    </span>
                    <code className="text-sm font-mono text-gray-900">
                      /api/oidc4vci/offer
                    </code>
                  </div>
                  <p className="text-sm text-gray-600">
                    Create a credential offer to initiate the OIDC4VCI flow
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      POST
                    </span>
                    <code className="text-sm font-mono text-gray-900">
                      /api/oidc4vci/token
                    </code>
                  </div>
                  <p className="text-sm text-gray-600">
                    Exchange pre-authorized code for access token (with PKCE)
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      POST
                    </span>
                    <code className="text-sm font-mono text-gray-900">
                      /api/oidc4vci/credential
                    </code>
                  </div>
                  <p className="text-sm text-gray-600">Issue verifiable credential</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-gray-900">Verifier Endpoints</h2>
              <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      POST
                    </span>
                    <code className="text-sm font-mono text-gray-900">
                      /api/verifier/presentation
                    </code>
                  </div>
                  <p className="text-sm text-gray-600">
                    Verify credential with optional DCQL selective disclosure
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-gray-900">Discovery Endpoints</h2>
              <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                      GET
                    </span>
                    <code className="text-sm font-mono text-gray-900">
                      /.well-known/openid-credential-issuer
                    </code>
                  </div>
                  <p className="text-sm text-gray-600">OpenID Credential Issuer metadata</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                      GET
                    </span>
                    <code className="text-sm font-mono text-gray-900">
                      /.well-known/jwks.json
                    </code>
                  </div>
                  <p className="text-sm text-gray-600">JSON Web Key Set for JWT verification</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-bold text-gray-900">Monitoring</h2>
              <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                      GET
                    </span>
                    <code className="text-sm font-mono text-gray-900">/api/health</code>
                  </div>
                  <p className="text-sm text-gray-600">Application health check</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                      GET
                    </span>
                    <code className="text-sm font-mono text-gray-900">/api/health/redis</code>
                  </div>
                  <p className="text-sm text-gray-600">Redis health check</p>
                </div>
              </div>
            </section>

            <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
              <h3 className="mb-2 text-lg font-semibold text-blue-900">
                Full Documentation Available
              </h3>
              <p className="mb-4 text-sm text-blue-800">
                For complete API documentation with request/response examples, try accessing the
                OpenAPI spec directly:
              </p>
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                View OpenAPI Spec (JSON)
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!spec) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
          <p className="text-gray-600">Loading API documentation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-2 text-3xl font-bold text-white">VitalCV API Documentation</h1>
          <p className="text-blue-100">
            Complete API reference for Verifiable Credentials issuance and verification
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <SwaggerUI spec={spec} />
      </div>

      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-8">
        <div className="mx-auto max-w-7xl text-center text-sm text-gray-600">
          <p>
            Powered by{' '}
            <a
              href="https://swagger.io/tools/swagger-ui/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Swagger UI
            </a>{' '}
            | OpenAPI 3.0 Specification
          </p>
          <p className="mt-2">
            <a href="/" className="text-blue-600 hover:underline">
              ← Back to Home
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
