import { Router, type Request, type Response } from 'express'
import { getPrivilegeCompatibility } from '../../../../services/graph/credential/privilegeCompatibility'

const router = Router()

router.get('/privilege-compatibility', async (req: Request, res: Response) => {
  const privilegeCode = (req.query.privilegeCode as string) ?? (req.query.code as string)

  if (!privilegeCode) {
    return res.status(400).json({
      error: 'missing_privilege_code',
      message: 'Query param privilegeCode is required',
    })
  }

  try {
    const payload = await getPrivilegeCompatibility(privilegeCode)
    return res.json(payload)
  } catch (error: any) {
    const status = error?.statusCode ?? 500
    const message = error?.message ?? 'Failed to resolve privilege compatibility'
    if (status >= 500) {
      console.error('Privilege compatibility error', error)
    }
    return res.status(status).json({
      error: 'privilege_compatibility_failed',
      message,
    })
  }
})

export default router
