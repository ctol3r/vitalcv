export interface ShortageClassification {
  region: string;
  specialty: string;
  status: 'SHORTAGE' | 'ABUNDANCE' | 'BALANCED';
  ratio: number;
  confidence: number;
}

export function shortageClassifier(region: string, specialty: string): ShortageClassification {
  // Simulate supply/demand analysis
  const demand = Math.random() * 100 + 50;
  const supply = Math.random() * 100 + 30;
  const ratio = supply / demand;

  let status: ShortageClassification['status'];
  if (ratio < 0.7) {
    status = 'SHORTAGE';
  } else if (ratio > 1.3) {
    status = 'ABUNDANCE';
  } else {
    status = 'BALANCED';
  }

  return {
    region,
    specialty,
    status,
    ratio: Math.round(ratio * 100) / 100,
    confidence: 0.8,
  };
}








