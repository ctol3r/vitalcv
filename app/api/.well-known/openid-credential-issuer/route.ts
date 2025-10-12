/**
 * OIDC4VCI Issuer Metadata Endpoint
 *
 * GET /.well-known/openid-credential-issuer
 * Returns credential issuer metadata (OIDC4VCI §11.2.2)
 */

import { NextResponse } from 'next/server'
import type { IssuerMetadata } from '@/lib/oidc4vci/types'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_ISSUER_URL || 'https://vitalcv.com'

  const metadata: IssuerMetadata = {
    credential_issuer: baseUrl,
    credential_endpoint: `${baseUrl}/api/oidc4vci/credential`,
    deferred_credential_endpoint: `${baseUrl}/api/oidc4vci/deferred`,
    credential_configurations_supported: {
      MedicalLicense: {
        format: 'jwt_vc_json',
        scope: 'MedicalLicense',
        cryptographic_binding_methods_supported: ['did:key', 'did:web', 'did:ethr'],
        credential_signing_alg_values_supported: ['ES256', 'ES256K', 'EdDSA'],
        proof_types_supported: {
          jwt: {
            proof_signing_alg_values_supported: ['ES256', 'ES256K', 'EdDSA'],
          },
        },
        display: [
          {
            name: 'Medical License',
            locale: 'en-US',
            logo: {
              url: `${baseUrl}/logos/medical-license.png`,
              alt_text: 'Medical License',
            },
            description: 'Verifiable medical license credential',
            background_color: '#12107c',
            text_color: '#FFFFFF',
          },
        ],
        credential_definition: {
          type: ['VerifiableCredential', 'MedicalLicense'],
          credentialSubject: {
            licenseNumber: {
              mandatory: true,
              value_type: 'string',
              display: [{ name: 'License Number', locale: 'en-US' }],
            },
            issuer: {
              mandatory: true,
              value_type: 'string',
              display: [{ name: 'Issuing Authority', locale: 'en-US' }],
            },
            expiryDate: {
              mandatory: false,
              value_type: 'string',
              display: [{ name: 'Expiry Date', locale: 'en-US' }],
            },
          },
        },
      },
      BoardCertification: {
        format: 'jwt_vc_json',
        scope: 'BoardCertification',
        cryptographic_binding_methods_supported: ['did:key', 'did:web', 'did:ethr'],
        credential_signing_alg_values_supported: ['ES256', 'ES256K', 'EdDSA'],
        proof_types_supported: {
          jwt: {
            proof_signing_alg_values_supported: ['ES256', 'ES256K', 'EdDSA'],
          },
        },
        credential_definition: {
          type: ['VerifiableCredential', 'BoardCertification'],
        },
      },
    },
    display: [
      {
        name: 'VitalCV Credential Issuer',
        locale: 'en-US',
        logo: {
          url: `${baseUrl}/logo.png`,
          alt_text: 'VitalCV',
        },
      },
    ],
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
