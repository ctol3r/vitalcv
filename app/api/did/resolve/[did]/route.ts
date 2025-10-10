import { NextRequest, NextResponse } from 'next/server'
import { resolveDID, resolvePublicKey, isValidDID } from '@/lib/did/resolver'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

/**
 * GET /api/did/resolve/[did]
 *
 * Resolve a DID to its DID Document
 *
 * Public endpoint with rate limiting
 *
 * Query parameters:
 * - cache: boolean (default: true) - Use cache
 * - publicKey: boolean (default: false) - Extract public key
 * - purpose: string (default: 'assertionMethod') - Key purpose
 *
 * Response:
 * {
 *   "didDocument": { ... },
 *   "didDocumentMetadata": { ... },
 *   "didResolutionMetadata": { ... },
 *   "publicKey": "0x..." (if publicKey=true)
 * }
 */
export const GET = withRateLimit(
  'api:general',
  RATE_LIMITS['api:general'],
  async (request: NextRequest, { params }: { params: { did: string } }) => {
    try {
      const did = decodeURIComponent(params.did)

      // Validate DID format
      if (!isValidDID(did)) {
        return NextResponse.json(
          {
            error: 'Invalid DID format',
            details: 'DID must follow format: did:method:method-specific-id',
          },
          { status: 400 }
        )
      }

      // Get query parameters
      const searchParams = request.nextUrl.searchParams
      const useCache = searchParams.get('cache') !== 'false'
      const extractPubKey = searchParams.get('publicKey') === 'true'
      const purpose = (searchParams.get('purpose') || 'assertionMethod') as
        | 'authentication'
        | 'assertionMethod'
        | 'keyAgreement'

      // Resolve DID
      const result = await resolveDID(did, useCache)

      if (!result.didDocument) {
        return NextResponse.json(
          {
            error: 'DID not found',
            details: result.didResolutionMetadata.error || 'Could not resolve DID',
          },
          { status: 404 }
        )
      }

      // Prepare response
      const response: any = {
        didDocument: result.didDocument,
        didDocumentMetadata: result.didDocumentMetadata,
        didResolutionMetadata: result.didResolutionMetadata,
      }

      // Extract public key if requested
      if (extractPubKey) {
        const publicKey = await resolvePublicKey(did, undefined, purpose)
        response.publicKey = publicKey
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('DID resolution error:', error)
      return NextResponse.json(
        { error: 'Failed to resolve DID' },
        { status: 500 }
      )
    }
  }
)
