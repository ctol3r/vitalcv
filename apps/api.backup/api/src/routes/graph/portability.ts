import { Router, type Request, type Response } from 'express'
import { getCredentialPortability } from '../../../../services/graph/credential/portability'

const router = Router()

router.get('/portability', async (req: Request, res: Response) => {
  const clinicianId = (req.query.clinicianId as string) ?? (req.query.id as string)

  if (!clinicianId) {
    return res.status(400).json({
      error: 'missing_clinician_id',
      message: 'Query param clinicianId is required',
    })
  }

  try {
    const includeTimeline = req.query.includeTimeline === 'true'
    const payload = await getCredentialPortability({
      clinicianId,
      includeTimeline,
    })
    return res.json(payload)
  } catch (error: any) {
    const status = error?.statusCode ?? 500
    const message = error?.message ?? 'Failed to compute credential portability'
    if (status >= 500) {
      console.error('Credential portability error', error)
    }
    return res.status(status).json({
      error: 'portability_failed',
      message,
    })
  }
})

export default router
