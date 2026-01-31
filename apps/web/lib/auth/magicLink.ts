export type MagicLinkIntent = 'resume' | 'resolve-task' | 'review'

export type MagicLinkPayload = {
  intent?: MagicLinkIntent
  taskId?: string
  label?: string
  issuedAt?: string
  expiresAt?: string
}

export type MagicLinkParseResult = {
  payload: MagicLinkPayload | null
  cleanedParams: string
}

const MAGIC_PARAM = 'ml'

const decodeBase64Url = (value: string) => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(normalized)
    }
    return Buffer.from(normalized, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

const encodeBase64Url = (value: string) => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window
      .btoa(value)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  return Buffer.from(value, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const isExpired = (expiresAt?: string) => {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

export function parseMagicLink(searchParams?: { toString(): string }): MagicLinkParseResult {
  const params = new URLSearchParams(searchParams?.toString() ?? '')
  const encoded = params.get(MAGIC_PARAM) ?? params.get('magic')

  let payload: MagicLinkPayload | null = null

  if (encoded) {
    const decoded = decodeBase64Url(encoded)
    if (decoded) {
      try {
        payload = JSON.parse(decoded) as MagicLinkPayload
      } catch {
        payload = null
      }
    }

    params.delete(MAGIC_PARAM)
    params.delete('magic')
  } else {
    const taskId = params.get('task')
    const intent = params.get('intent') as MagicLinkIntent | null
    if (taskId || intent) {
      payload = {
        taskId: taskId ?? undefined,
        intent: intent ?? 'resume',
        label: params.get('label') ?? undefined,
        issuedAt: params.get('issuedAt') ?? undefined,
        expiresAt: params.get('expiresAt') ?? undefined,
      }
    }

    params.delete('task')
    params.delete('intent')
    params.delete('label')
    params.delete('issuedAt')
    params.delete('expiresAt')
  }

  if (payload && isExpired(payload.expiresAt)) {
    payload = null
  }

  return { payload, cleanedParams: params.toString() }
}

export function buildMagicLink(path: string, payload: MagicLinkPayload) {
  const encoded = encodeBase64Url(JSON.stringify(payload))
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${MAGIC_PARAM}=${encoded}`
}
