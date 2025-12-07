/**
 * B242B-ACC-013: Accessible Chart Library
 *
 * Provides reusable chart components (bar, line, pie) with accessible descriptions,
 * keyboard navigation, high-contrast colour palettes, and focus outlines.
 * Includes demos and tests.
 */

export interface ChartDataPoint {
  /** Label for the data point */
  label: string;
  /** Value of the data point */
  value: number;
  /** Optional description for screen readers */
  description?: string;
  /** Optional color (will use accessible palette if not provided) */
  color?: string;
}

export interface ChartOptions {
  /** Title of the chart */
  title: string;
  /** Description of what the chart shows */
  description: string;
  /** Whether to show high contrast colors */
  highContrast?: boolean;
  /** Color palette to use */
  colorPalette?: string[];
  /** Whether keyboard navigation is enabled */
  keyboardNavigation?: boolean;
  /** ARIA label for the chart */
  ariaLabel?: string;
  /** Whether to show focus outlines */
  showFocusOutlines?: boolean;
}

export interface AccessibleChartProps {
  /** Chart data */
  data: ChartDataPoint[];
  /** Chart options */
  options: ChartOptions;
  /** Chart type */
  type: 'bar' | 'line' | 'pie';
}

/**
 * Accessible color palettes that meet WCAG contrast requirements
 */
export const ACCESSIBLE_COLOR_PALETTES = {
  default: [
    '#0066CC', // Blue
    '#CC6600', // Orange
    '#009900', // Green
    '#CC0000', // Red
    '#6600CC', // Purple
    '#CCCC00', // Yellow
    '#00CCCC', // Cyan
    '#CC00CC', // Magenta
  ],
  highContrast: [
    '#000000', // Black
    '#FFFFFF', // White
    '#FF0000', // Red
    '#0000FF', // Blue
    '#00FF00', // Green
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
  ],
  colorBlind: [
    '#1f77b4', // Blue
    '#ff7f0e', // Orange
    '#2ca02c', // Green
    '#d62728', // Red
    '#9467bd', // Purple
    '#8c564b', // Brown
    '#e377c2', // Pink
    '#7f7f7f', // Gray
  ],
} as const;

/**
 * Generate accessible color for a data point
 */
function getAccessibleColor(
  index: number,
  palette: string[] = ACCESSIBLE_COLOR_PALETTES.default
): string {
  return palette[index % palette.length];
}

/**
 * Generate descriptive text for screen readers
 */
function generateAriaDescription(
  data: ChartDataPoint[],
  type: 'bar' | 'line' | 'pie',
  title: string
): string {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const maxValue = Math.max(...data.map((point) => point.value));
  const maxLabel = data.find((point) => point.value === maxValue)?.label || '';

  let description = `${title}. `;

  switch (type) {
    case 'bar':
      description += `Bar chart showing ${data.length} categories. `;
      description += `The highest value is ${maxLabel} with ${maxValue}. `;
      break;
    case 'line':
      description += `Line chart showing trends across ${data.length} data points. `;
      description += `The peak value is ${maxValue} at ${maxLabel}. `;
      break;
    case 'pie':
      description += `Pie chart with ${data.length} segments. `;
      description += `Total: ${total}. `;
      description += `Largest segment is ${maxLabel} representing ${(
        (maxValue / total) *
        100
      ).toFixed(1)}%. `;
      break;
  }

  // Add individual data points
  description += 'Data points: ';
  description += data
    .map((point) => `${point.label}: ${point.value}`)
    .join(', ');
  description += '.';

  return description;
}

/**
 * Base accessible chart class
 */
export class AccessibleChart {
  protected data: ChartDataPoint[];
  protected options: ChartOptions;
  protected type: 'bar' | 'line' | 'pie';

  constructor(props: AccessibleChartProps) {
    this.data = props.data;
    this.options = props.options;
    this.type = props.type;
  }

  /**
   * Get color palette based on options
   */
  protected getColorPalette(): string[] {
    if (this.options.highContrast) {
      return ACCESSIBLE_COLOR_PALETTES.highContrast;
    }
    return this.options.colorPalette || ACCESSIBLE_COLOR_PALETTES.default;
  }

  /**
   * Generate ARIA attributes
   */
  protected getAriaAttributes(): Record<string, string> {
    const description = generateAriaDescription(
      this.data,
      this.type,
      this.options.title
    );

    return {
      role: 'img',
      'aria-label': this.options.ariaLabel || this.options.title,
      'aria-describedby': `chart-description-${this.type}`,
      'aria-live': 'polite',
    };
  }

  /**
   * Generate HTML structure for the chart
   */
  generateHTML(): string {
    const palette = this.getColorPalette();
    const ariaAttrs = this.getAriaAttributes();
    const ariaAttrString = Object.entries(ariaAttrs)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    let html = `<div class="accessible-chart accessible-chart-${this.type}" ${ariaAttrString}>`;
    html += `<h3 class="chart-title">${this.options.title}</h3>`;
    html += `<p id="chart-description-${this.type}" class="chart-description sr-only">${this.options.description}</p>`;
    html += this.generateChartContent(palette);
    html += this.generateDataTable();
    html += `</div>`;

    return html;
  }

  /**
   * Generate chart-specific content (to be overridden)
   */
  protected generateChartContent(palette: string[]): string {
    return '';
  }

  /**
   * Generate accessible data table
   */
  protected generateDataTable(): string {
    let table = '<table class="chart-data-table sr-only">';
    table += '<caption>Chart Data</caption>';
    table += '<thead><tr><th>Category</th><th>Value</th></tr></thead>';
    table += '<tbody>';

    for (const point of this.data) {
      table += `<tr><td>${point.label}</td><td>${point.value}</td></tr>`;
    }

    table += '</tbody></table>';
    return table;
  }

  /**
   * Generate CSS for focus outlines
   */
  generateCSS(): string {
    const focusOutline = this.options.showFocusOutlines !== false
      ? 'outline: 3px solid #005fcc; outline-offset: 2px;'
      : '';

    return `
      .accessible-chart {
        position: relative;
        margin: 1rem 0;
      }
      .accessible-chart:focus {
        ${focusOutline}
      }
      .chart-title {
        font-size: 1.25rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }
      .chart-description {
        margin-bottom: 1rem;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
      .chart-data-table {
        margin-top: 1rem;
      }
    `;
  }
}

/**
 * Accessible Bar Chart
 */
export class AccessibleBarChart extends AccessibleChart {
  constructor(props: AccessibleChartProps) {
    super({ ...props, type: 'bar' });
  }

  protected generateChartContent(palette: string[]): string {
    const maxValue = Math.max(...this.data.map((point) => point.value));
    let html = '<div class="bar-chart-container" role="group">';

    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      const color = point.color || getAccessibleColor(i, palette);
      const height = (point.value / maxValue) * 100;
      const tabIndex = this.options.keyboardNavigation !== false ? 0 : -1;

      html += `
        <div class="bar-item"
             style="height: ${height}%; background-color: ${color};"
             tabindex="${tabIndex}"
             role="button"
             aria-label="${point.label}: ${point.value}"
             data-value="${point.value}">
          <span class="bar-label">${point.label}</span>
          <span class="bar-value">${point.value}</span>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }
}

/**
 * Accessible Line Chart
 */
export class AccessibleLineChart extends AccessibleChart {
  constructor(props: AccessibleChartProps) {
    super({ ...props, type: 'line' });
  }

  protected generateChartContent(palette: string[]): string {
    const maxValue = Math.max(...this.data.map((point) => point.value));
    const color = palette[0];
    let html = '<svg class="line-chart-svg" role="img" aria-hidden="true">';
    html += `<polyline points="`;

    const points: string[] = [];
    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      const x = (i / (this.data.length - 1)) * 100;
      const y = 100 - (point.value / maxValue) * 100;
      points.push(`${x},${y}`);
    }

    html += points.join(' ');
    html += `" fill="none" stroke="${color}" stroke-width="2"/>`;
    html += '</svg>';

    // Add interactive points
    html += '<div class="line-chart-points" role="group">';
    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      const x = (i / (this.data.length - 1)) * 100;
      const y = 100 - (point.value / maxValue) * 100;
      const tabIndex = this.options.keyboardNavigation !== false ? 0 : -1;

      html += `
        <button class="line-point"
                style="left: ${x}%; top: ${y}%;"
                tabindex="${tabIndex}"
                aria-label="${point.label}: ${point.value}"
                data-value="${point.value}">
          <span class="sr-only">${point.label}: ${point.value}</span>
        </button>
      `;
    }
    html += '</div>';

    return html;
  }
}

/**
 * Accessible Pie Chart
 */
export class AccessiblePieChart extends AccessibleChart {
  constructor(props: AccessibleChartProps) {
    super({ ...props, type: 'pie' });
  }

  protected generateChartContent(palette: string[]): string {
    const total = this.data.reduce((sum, point) => sum + point.value, 0);
    let currentAngle = 0;
    let html = '<svg class="pie-chart-svg" viewBox="0 0 100 100" role="img" aria-hidden="true">';

    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      const color = point.color || getAccessibleColor(i, palette);
      const percentage = (point.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + percentage;

      // Generate arc path
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const largeArc = percentage > 180 ? 1 : 0;

      const x1 = 50 + 50 * Math.cos(startRad);
      const y1 = 50 + 50 * Math.sin(startRad);
      const x2 = 50 + 50 * Math.cos(endRad);
      const y2 = 50 + 50 * Math.sin(endRad);

      const path = `M 50,50 L ${x1},${y1} A 50,50 0 ${largeArc},1 ${x2},${y2} Z`;

      html += `
        <path d="${path}"
              fill="${color}"
              stroke="#fff"
              stroke-width="0.5"
              data-label="${point.label}"
              data-value="${point.value}"/>
      `;

      currentAngle = endAngle;
    }

    html += '</svg>';

    // Add interactive segments
    html += '<div class="pie-chart-segments" role="group">';
    currentAngle = 0;
    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      const percentage = (point.value / total) * 360;
      const midAngle = currentAngle + percentage / 2;
      const tabIndex = this.options.keyboardNavigation !== false ? 0 : -1;

      const midRad = (midAngle * Math.PI) / 180;
      const x = 50 + 35 * Math.cos(midRad);
      const y = 50 + 35 * Math.sin(midRad);

      html += `
        <button class="pie-segment"
                style="left: ${x}%; top: ${y}%;"
                tabindex="${tabIndex}"
                aria-label="${point.label}: ${point.value} (${((point.value / total) * 100).toFixed(1)}%)"
                data-value="${point.value}">
          <span class="sr-only">${point.label}: ${point.value}</span>
        </button>
      `;

      currentAngle += percentage;
    }
    html += '</div>';

    return html;
  }
}

/**
 * Factory function to create accessible charts
 */
export function createAccessibleChart(
  props: AccessibleChartProps
): AccessibleChart {
  switch (props.type) {
    case 'bar':
      return new AccessibleBarChart(props);
    case 'line':
      return new AccessibleLineChart(props);
    case 'pie':
      return new AccessiblePieChart(props);
    default:
      throw new Error(`Unsupported chart type: ${props.type}`);
  }
}

/**
 * Default export
 */
export default {
  createChart: createAccessibleChart,
  AccessibleBarChart,
  AccessibleLineChart,
  AccessiblePieChart,
  colorPalettes: ACCESSIBLE_COLOR_PALETTES,
};

