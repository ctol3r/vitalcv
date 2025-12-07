import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract template preview
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // In production, this would fetch the template content from the database
    const mockContent = `# Contract Template Preview

## Template ID: ${id}

This is a preview of the contract template content. In production, this would be rendered from the template's markdown content with placeholders replaced.

### Key Terms:
- Revenue Share: {{basisPoints}} basis points
- Minimum Guarantee: {{minGuarantee}}
- Maximum Cap: {{maxCap}}

### Parties:
- Organization: {{orgName}}
- Counterparty: {{counterpartyName}}

### Effective Date:
{{effectiveDate}}

### Expiry Date:
{{expiryDate}}

### Terms and Conditions:
[Template content would be rendered here with all placeholders filled in]

---

*This is a preview. Actual contract content will be generated when creating a contract from this template.*`

    return NextResponse.json({ content: mockContent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

