import { deflateSync } from 'node:zlib';
import type { DemandProjectionPoint } from './demand';
import type { SupplyProjectionPoint, SupplySimulationResult } from './supply';

export interface CapacityGapPoint {
  monthIndex: number;
  date: string;
  demand: number;
  supply: number;
  supplyWithVital: number;
  gap: number;
  gapWithVital: number;
  coverageRatio: number;
  coverageRatioVital: number;
  severity: 'balanced' | 'monitor' | 'shortage' | 'crisis';
  action: string;
}

export interface CapacityGapResult {
  points: CapacityGapPoint[];
  summary: {
    peakGap: number;
    averageGap: number;
    worstMonth: string;
    coverage: number;
    coverageWithVital: number;
    vitalCvLift: number;
    recommendedHires: number;
  };
  insights: string[];
  vitalCvOverlay: {
    coverageDelta: number;
    onboardingAccelerationWeeks: number;
    unlockedFte: number;
    message: string;
  };
  exports: {
    pngDataUrl: string;
    csv: string;
  };
}

interface CalculateGapInput {
  scenarioName: string;
  demand: DemandProjectionPoint[];
  supply: SupplyProjectionPoint[];
  supplySummary: SupplySimulationResult['summary'];
}

export function calculateCapacityGap(input: CalculateGapInput): CapacityGapResult {
  const length = Math.min(input.demand.length, input.supply.length);
  const points: CapacityGapPoint[] = [];

  for (let index = 0; index < length; index += 1) {
    const demandPoint = input.demand[index];
    const supplyPoint = input.supply[index];
    const demandValue = demandPoint?.demand ?? 0;
    const supplyValue = supplyPoint?.supply ?? 0;
    const supplyVitalValue = supplyPoint?.supplyWithVitalCv ?? supplyValue;
    const gap = demandValue - supplyValue;
    const gapWithVital = demandValue - supplyVitalValue;

    const coverage = demandValue > 0 ? supplyValue / demandValue : 1;
    const coverageVital = demandValue > 0 ? supplyVitalValue / demandValue : 1;
    const severity = classifyGap(Math.max(0, gap), demandValue);

    points.push({
      monthIndex: demandPoint?.monthIndex ?? index,
      date: demandPoint?.date ?? supplyPoint?.date ?? '',
      demand: round(demandValue),
      supply: round(supplyValue),
      supplyWithVital: round(supplyVitalValue),
      gap: round(gap),
      gapWithVital: round(gapWithVital),
      coverageRatio: round(coverage),
      coverageRatioVital: round(coverageVital),
      severity,
      action: recommendAction(severity, coverage),
    });
  }

  const summary = buildSummary(points);
  const insights = buildInsights(points, summary);
  const vitalCvOverlay = buildVitalOverlay(points, input.supplySummary);
  const exports = buildScenarioExports(points, input.scenarioName);

  return {
    points,
    summary,
    insights,
    vitalCvOverlay,
    exports,
  };
}

function buildSummary(points: CapacityGapPoint[]) {
  if (!points.length) {
    return {
      peakGap: 0,
      averageGap: 0,
      worstMonth: '',
      coverage: 0,
      coverageWithVital: 0,
      vitalCvLift: 0,
      recommendedHires: 0,
    };
  }

  const totals = points.reduce(
    (acc, point) => {
      const positiveGap = Math.max(0, point.gap);
      const positiveGapVital = Math.max(0, point.gapWithVital);
      return {
        gap: acc.gap + positiveGap,
        gapVital: acc.gapVital + positiveGapVital,
        demand: acc.demand + point.demand,
        supply: acc.supply + point.supply,
        supplyVital: acc.supplyVital + point.supplyWithVital,
        peakGap: Math.max(acc.peakGap, positiveGap),
        worstPoint:
          positiveGap > acc.worstGap
            ? point
            : acc.worstPoint,
        worstGap: Math.max(acc.worstGap, positiveGap),
      };
    },
    {
      gap: 0,
      gapVital: 0,
      demand: 0,
      supply: 0,
      supplyVital: 0,
      peakGap: 0,
      worstPoint: points[0],
      worstGap: 0,
    },
  );

  const averageGap = totals.gap / Math.max(1, points.length);
  const averageGapVital = totals.gapVital / Math.max(1, points.length);

  return {
    peakGap: round(totals.peakGap),
    averageGap: round(averageGap),
    worstMonth: totals.worstPoint?.date ?? '',
    coverage: round(totals.supply / Math.max(1, totals.demand)),
    coverageWithVital: round(totals.supplyVital / Math.max(1, totals.demand)),
    vitalCvLift: round(Math.max(0, averageGap - averageGapVital)),
    recommendedHires: Math.max(0, Math.round(totals.peakGap)),
  };
}

function buildInsights(points: CapacityGapPoint[], summary: CapacityGapResult['summary']): string[] {
  const insights: string[] = [];

  if (summary.peakGap > 0) {
    insights.push(
      `Peak shortfall of ${summary.peakGap.toFixed(1)} FTE projected around ${formatMonth(summary.worstMonth)}.`,
    );
  } else {
    insights.push('No critical shortages detected; supply is tracking demand.');
  }

  const crisisMonths = points.filter((point) => point.severity === 'crisis');
  if (crisisMonths.length) {
    insights.push(
      `Crisis coverage expected for ${crisisMonths.length} month(s): ${crisisMonths
        .map((point) => formatMonth(point.date))
        .join(', ')}.`,
    );
  }

  const monitorMonths = points.filter((point) => point.severity === 'monitor');
  if (monitorMonths.length && crisisMonths.length === 0) {
    insights.push(
      `Monitoring recommended for ${monitorMonths.length} month(s); minor flex capacity closes residual gaps.`,
    );
  }

  if (summary.vitalCvLift > 0.25) {
    insights.push(
      `VitalCV onboarding recovers ~${summary.vitalCvLift.toFixed(1)} FTE/month versus baseline.`,
    );
  }

  return insights;
}

function buildVitalOverlay(
  points: CapacityGapPoint[],
  supplySummary: SupplySimulationResult['summary'],
): CapacityGapResult['vitalCvOverlay'] {
  const coverageVital =
    points.reduce((sum, point) => sum + point.coverageRatioVital, 0) / Math.max(1, points.length);
  const coverageBaseline =
    points.reduce((sum, point) => sum + point.coverageRatio, 0) / Math.max(1, points.length);

  const coverageDelta = coverageVital - coverageBaseline;

  return {
    coverageDelta: round(coverageDelta * 100, 1),
    onboardingAccelerationWeeks: supplySummary.vitalCvAccelerationWeeks,
    unlockedFte: supplySummary.vitalCvUnlockedFte,
    message: `VitalCV boosts coverage by ${(coverageDelta * 100).toFixed(1)}pts and accelerates onboarding by ${supplySummary.vitalCvAccelerationWeeks.toFixed(
      1,
    )} weeks.`,
  };
}

function classifyGap(gap: number, demand: number): CapacityGapPoint['severity'] {
  if (gap <= 0) return 'balanced';
  const ratio = demand > 0 ? gap / demand : 0;
  if (ratio < 0.05) return 'monitor';
  if (ratio < 0.12) return 'shortage';
  return 'crisis';
}

function recommendAction(
  severity: CapacityGapPoint['severity'],
  coverage: number,
): string {
  switch (severity) {
    case 'crisis':
      return 'Trigger surge staffing + cross-credential VitalCV pool.';
    case 'shortage':
      return coverage < 0.9 ? 'Accelerate onboarding and backfill retirements.' : 'Leverage float pool.';
    case 'monitor':
      return 'Monitor attrition, keep VitalCV slate warm.';
    default:
      return 'Maintain baseline hiring cadence.';
  }
}

function buildScenarioExports(points: CapacityGapPoint[], scenarioName: string) {
  return {
    pngDataUrl: buildScenarioPng(points, scenarioName),
    csv: buildScenarioCsv(points),
  };
}

function buildScenarioCsv(points: CapacityGapPoint[]): string {
  const header = 'month,demand,supply,supply_with_vital,gap,gap_with_vital,severity,recommendation';
  const rows = points.map((point) => {
    const month = formatMonth(point.date);
    return [
      month,
      point.demand.toFixed(2),
      point.supply.toFixed(2),
      point.supplyWithVital.toFixed(2),
      point.gap.toFixed(2),
      point.gapWithVital.toFixed(2),
      point.severity,
      `"${point.action}"`,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

function buildScenarioPng(points: CapacityGapPoint[], scenarioName: string): string {
  const width = 720;
  const height = 360;
  const marginX = 40;
  const marginY = 30;
  const pixels = new Uint8ClampedArray(width * height * 4);
  fillBackground(pixels, width, height, [7, 10, 19]);

  const demandMax = Math.max(
    1,
    ...points.map((point) => Math.max(point.demand, point.supplyWithVital)),
  );
  const chartWidth = width - marginX * 2;
  const chartHeight = height - marginY * 2;

  drawAxes(pixels, width, height, marginX, marginY);

  const toX = (index: number) => marginX + (chartWidth * index) / Math.max(1, points.length - 1);
  const toY = (value: number) =>
    height - marginY - Math.min(chartHeight, (value / demandMax) * chartHeight);

  drawPolyline(
    pixels,
    width,
    toSeries(points, (point) => [toX(point.monthIndex), toY(point.demand)]),
    [249, 115, 22],
  );
  drawPolyline(
    pixels,
    width,
    toSeries(points, (point) => [toX(point.monthIndex), toY(point.supply)]),
    [37, 99, 235],
  );
  drawPolyline(
    pixels,
    width,
    toSeries(points, (point) => [toX(point.monthIndex), toY(point.supplyWithVital)]),
    [34, 197, 94],
  );

  const pngBuffer = encodePng(pixels, width, height);
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

type PointSeries = Array<[number, number]>;

function toSeries(points: CapacityGapPoint[], mapper: (point: CapacityGapPoint) => [number, number]): PointSeries {
  return points.map(mapper);
}

function fillBackground(pixels: Uint8ClampedArray, width: number, height: number, color: [number, number, number]) {
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 4] = color[0];
    pixels[i * 4 + 1] = color[1];
    pixels[i * 4 + 2] = color[2];
    pixels[i * 4 + 3] = 255;
  }
}

function drawAxes(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  marginX: number,
  marginY: number,
) {
  const axisColor: [number, number, number] = [59, 63, 80];
  for (let x = marginX; x < width - marginX / 2; x += 1) {
    setPixel(pixels, width, x, height - marginY, axisColor);
  }
  for (let y = marginY / 2; y < height - marginY; y += 1) {
    setPixel(pixels, width, marginX, y, axisColor);
  }
}

function drawPolyline(
  pixels: Uint8ClampedArray,
  width: number,
  series: PointSeries,
  color: [number, number, number],
) {
  for (let i = 1; i < series.length; i += 1) {
    const [x1, y1] = series[i - 1];
    const [x2, y2] = series[i];
    drawLine(pixels, width, Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), color);
  }
}

function drawLine(
  pixels: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: [number, number, number],
) {
  let currentX = x0;
  let currentY = y0;
  const deltaX = Math.abs(x1 - x0);
  const deltaY = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let err = deltaX + deltaY;

  while (true) {
    setPixel(pixels, width, currentX, currentY, color);
    if (currentX === x1 && currentY === y1) break;
    const e2 = 2 * err;
    if (e2 >= deltaY) {
      err += deltaY;
      currentX += stepX;
    }
    if (e2 <= deltaX) {
      err += deltaX;
      currentY += stepY;
    }
  }
}

function setPixel(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  color: [number, number, number],
) {
  const height = Math.floor(pixels.length / (width * 4));
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  const index = (y * width + x) * 4;
  if (index < 0 || index + 3 >= pixels.length) {
    return;
  }
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = 255;
}

function encodePng(pixels: Uint8ClampedArray, width: number, height: number): Buffer {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < width; x += 1) {
      const srcIndex = (y * width + x) * 4;
      const destIndex = rowStart + 1 + x * 4;
      raw[destIndex] = pixels[srcIndex];
      raw[destIndex + 1] = pixels[srcIndex + 1];
      raw[destIndex + 2] = pixels[srcIndex + 2];
      raw[destIndex + 3] = pixels[srcIndex + 3];
    }
  }

  const idat = deflateSync(raw);

  return Buffer.concat([
    header,
    buildChunk('IHDR', ihdr),
    buildChunk('IDAT', idat),
    buildChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function formatMonth(date: string) {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toISOString().slice(0, 7);
}


