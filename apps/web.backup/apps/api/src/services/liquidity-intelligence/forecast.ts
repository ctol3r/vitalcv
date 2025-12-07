export interface LiquidityForecast {
  region: string;
  specialty: string;
  forecast: Array<{
    date: string;
    supply: number;
    demand: number;
    ratio: number;
  }>;
  confidence: number;
}

export function liquidityForecast(region: string, specialty: string, days: number): LiquidityForecast {
  const baseSupply = 100;
  const baseDemand = 80;

  const forecast = Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i * 7);
    const supply = baseSupply + (Math.random() - 0.5) * 20;
    const demand = baseDemand + (Math.random() - 0.5) * 15;

    return {
      date: date.toISOString().split('T')[0],
      supply: Math.round(supply),
      demand: Math.round(demand),
      ratio: Math.round((supply / demand) * 100) / 100,
    };
  });

  return {
    region,
    specialty,
    forecast,
    confidence: 0.75,
  };
}








