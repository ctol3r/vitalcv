/**
 * Apply a preference nudge (J6c) — a merge-safe read-modify-write.
 *
 * The preferences PUT REPLACES the stored bag, so applying a nudge must first
 * read the clinician's current preferences and merge the one field in — a bare
 * PUT of `{ remoteInterest }` would wipe every other stated preference. The
 * changed field is engine-backed, so this genuinely re-ranks; nothing else the
 * clinician set is touched.
 *
 * Returns true only when the merged preferences were persisted. Best-effort on
 * failure — a nudge is an optional convenience, never load-bearing.
 */
export async function applyPreferenceNudge(field: string, value: string): Promise<boolean> {
  try {
    let current: Record<string, unknown> = {}
    const getRes = await fetch('/api/matcha/preferences', { method: 'GET' })
    if (getRes.ok) {
      const json = (await getRes.json().catch(() => null)) as { preferences?: unknown } | null
      if (json && typeof json.preferences === 'object' && json.preferences) {
        current = json.preferences as Record<string, unknown>
      }
    }

    const merged = { ...current, [field]: value }
    const putRes = await fetch('/api/matcha/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferences: merged }),
    })
    if (!putRes.ok) return false
    const body = (await putRes.json().catch(() => ({}))) as { ok?: boolean }
    return body.ok !== false
  } catch {
    return false
  }
}
