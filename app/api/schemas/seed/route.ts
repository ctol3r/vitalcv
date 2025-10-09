import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  CREDENTIAL_SCHEMAS,
  DRIVER_LICENSE_SCHEMA,
  HEALTH_PASS_SCHEMA,
  PROFESSIONAL_LICENSE_SCHEMA,
  UNIVERSITY_DEGREE_SCHEMA,
  AGE_VERIFICATION_SCHEMA,
} from '@/lib/credentials/schemas'
import { CREDENTIAL_TYPES } from '@/lib/credentials/types'

/**
 * POST /api/schemas/seed
 *
 * Seed the database with predefined credential schemas.
 *
 * This endpoint creates the standard credential schemas if they don't exist.
 *
 * Response:
 * {
 *   "message": "Seeded X schemas",
 *   "schemas": [...]
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const schemasToSeed = [
      {
        type: CREDENTIAL_TYPES.DRIVER_LICENSE,
        name: 'Driver License',
        description: 'A verifiable credential representing a driver license',
        version: '1.0.0',
        jsonSchema: DRIVER_LICENSE_SCHEMA,
        privacy: 'plain' as const,
      },
      {
        type: CREDENTIAL_TYPES.HEALTH_PASS,
        name: 'Health Pass',
        description: 'A verifiable health pass credential',
        version: '1.0.0',
        jsonSchema: HEALTH_PASS_SCHEMA,
        privacy: 'plain' as const,
      },
      {
        type: CREDENTIAL_TYPES.PROFESSIONAL_LICENSE,
        name: 'Professional License',
        description: 'A verifiable professional license credential',
        version: '1.0.0',
        jsonSchema: PROFESSIONAL_LICENSE_SCHEMA,
        privacy: 'plain' as const,
      },
      {
        type: CREDENTIAL_TYPES.UNIVERSITY_DEGREE,
        name: 'University Degree',
        description: 'A verifiable university degree credential',
        version: '1.0.0',
        jsonSchema: UNIVERSITY_DEGREE_SCHEMA,
        privacy: 'plain' as const,
      },
      {
        type: CREDENTIAL_TYPES.AGE_VERIFICATION,
        name: 'Age Verification',
        description: 'A privacy-preserving age verification credential',
        version: '1.0.0',
        jsonSchema: AGE_VERIFICATION_SCHEMA,
        privacy: 'zkp' as const, // ZKP for privacy
      },
    ]

    const createdSchemas = []

    for (const schemaData of schemasToSeed) {
      // Check if already exists
      const existing = await prisma.credentialSchema.findUnique({
        where: { type: schemaData.type },
      })

      if (!existing) {
        const created = await prisma.credentialSchema.create({
          data: {
            ...schemaData,
            active: true,
          },
        })
        createdSchemas.push(created)
      }
    }

    if (createdSchemas.length === 0) {
      return NextResponse.json({
        message: 'All schemas already exist',
        count: 0,
      })
    }

    return NextResponse.json({
      message: `Seeded ${createdSchemas.length} schemas`,
      count: createdSchemas.length,
      schemas: createdSchemas,
    })
  } catch (error) {
    console.error('Seed schemas error:', error)
    return NextResponse.json(
      { error: 'Failed to seed schemas' },
      { status: 500 }
    )
  }
}
