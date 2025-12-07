export interface AutomationIndex {
  orgId: string;
  index: number;
  adoption: number;
  automation: string[];
}

export function automationIndex(orgId: string): AutomationIndex {
  const adoption = Math.random() * 0.4 + 0.5; // 0.5-0.9
  const index = adoption * 100;

  return {
    orgId,
    index: Math.round(index),
    adoption: Math.round(adoption * 100) / 100,
    automation: ['ocr_verification', 'auto_sanctions_check', 'credential_routing'],
  };
}








