export interface VelocityMetrics {
  region: string;
  specialty: string;
  daysToFill: number;
  trend: 'improving' | 'declining' | 'stable';
  historical: Array<{ date: string; days: number }>;
}

export function roleVelocityTracker(region: string, specialty: string): VelocityMetrics {
  const baseDays = 30 + Math.random() * 20; // 30-50 days
  const daysToFill = Math.round(baseDays);

  const historical = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return {
      date: date.toISOString().split('T')[0],
      days: Math.round(baseDays + (Math.random() - 0.5) * 10),
    };
  });

  const trend = historical[historical.length - 1].days < historical[0].days
    ? 'improving'
    : historical[historical.length - 1].days > historical[0].days
    ? 'declining'
    : 'stable';

  return {
    region,
    specialty,
    daysToFill,
    trend,
    historical,
  };
}








