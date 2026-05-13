// Foundation tier: API key infrastructure is scaffolded but no keys are active in production.
// keysInProduction must remain false until the key rotation + vault integration wave ships.
export type ApiKeyFoundationState = {
  keysInProduction: false;
  reason: 'foundation_only';
};

export function getApiKeyFoundationState(): ApiKeyFoundationState {
  return { keysInProduction: false, reason: 'foundation_only' };
}
