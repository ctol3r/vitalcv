export interface SafetyAlignment {
  orgId: string;
  alignment: number;
  compliance: number;
  gaps: string[];
}

export function safetyAlignment(orgId: string): SafetyAlignment {
  const alignment = Math.random() * 0.3 + 0.7; // 0.7-1.0
  const compliance = Math.random() * 0.2 + 0.8; // 0.8-1.0

  return {
    orgId,
    alignment: Math.round(alignment * 100) / 100,
    compliance: Math.round(compliance * 100) / 100,
    gaps: Math.random() > 0.7 ? ['real_time_sanctions'] : [],
  };
}








