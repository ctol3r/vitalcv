export interface CrossMarketModel {
  regions: string[];
  liquidity: Record<string, {
    supply: number;
    demand: number;
    ratio: number;
  }>;
  opportunities: Array<{
    from: string;
    to: string;
    potential: number;
  }>;
}

export function crossMarketModeling(regions: string[]): CrossMarketModel {
  const liquidity: CrossMarketModel['liquidity'] = {};

  regions.forEach(region => {
    const supply = Math.random() * 100 + 50;
    const demand = Math.random() * 100 + 50;
    liquidity[region] = {
      supply: Math.round(supply),
      demand: Math.round(demand),
      ratio: Math.round((supply / demand) * 100) / 100,
    };
  });

  const opportunities: CrossMarketModel['opportunities'] = [];
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      if (Math.random() > 0.5) {
        opportunities.push({
          from: regions[i],
          to: regions[j],
          potential: Math.round((Math.random() * 0.3 + 0.1) * 100) / 100,
        });
      }
    }
  }

  return {
    regions,
    liquidity,
    opportunities,
  };
}








