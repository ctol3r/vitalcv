export interface RegulatorAlignment {
  clinicianId: string;
  regulator: string;
  aligned: boolean;
  gaps: string[];
  compliance: number;
}

export function regulatorAlignment(clinicianId: string, regulator: string): RegulatorAlignment {
  const aligned = Math.random() > 0.3;

  return {
    clinicianId,
    regulator,
    aligned,
    gaps: aligned ? [] : ['missing_documentation', 'language_requirement'],
    compliance: aligned ? 0.95 : 0.65,
  };
}








