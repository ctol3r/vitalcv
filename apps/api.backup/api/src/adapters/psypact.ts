export async function verifyAPIT(epassport: string) {
  return {
    ok: true,
    epassport,
    expires_at: new Date(Date.now() + 90 * 86400000)
  };
}

export async function verifyTAP(epassport: string) {
  return {
    ok: true,
    epassport,
    expires_at: new Date(Date.now() + 30 * 86400000)
  };
}

