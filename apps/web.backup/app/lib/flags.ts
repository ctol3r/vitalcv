export function isAgentEnabled(user?: { role?: string }) {
  return user?.role === 'admin' || process.env.NEXT_PUBLIC_AGENT_PREVIEW === '1';
}

export function requireAgentEnabled() {
  if (!isAgentEnabled({ role: 'admin' })) {
    throw new Error('AGENT_DISABLED');
  }
}

