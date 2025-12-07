import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract content
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const searchParams = request.nextUrl.searchParams
    const version = searchParams.get('version') || 'latest'

    // In production, this would fetch contract content from the database
    const mockContent = `# Partner Contract Agreement

## Contract ID: ${id}
## Version: ${version}

### Parties
- **Organization**: Demo Organization
- **Counterparty**: Acme Healthcare Inc.

### Effective Date
${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}

### Expiry Date
${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}

### Revenue Share Terms
- Basis Points: 500 (5%)
- Minimum Guarantee: $10,000
- Maximum Cap: $1,000,000

### Terms and Conditions

1. **Revenue Sharing**
   - The counterparty agrees to share 5% of revenue generated through the partnership.
   - Payments will be made monthly within 30 days of the end of each calendar month.

2. **Obligations**
   - Both parties agree to maintain confidentiality of proprietary information.
   - Regular reporting on revenue and usage metrics is required.

3. **Termination**
   - Either party may terminate this agreement with 30 days written notice.
   - Upon termination, all outstanding obligations must be fulfilled.

### Signatures

This contract has been signed by all parties on ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}.

---

*This is a mock contract. In production, this content would be generated from the contract template with actual data.*`

    return NextResponse.json({ content: mockContent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

