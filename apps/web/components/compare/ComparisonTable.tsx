/** Side-by-side feature comparison table used across /compare/* pages. */
export interface ComparisonRow {
  feature: string;
  incumbent: string;
  vitalcv: string;
  /** Optional: highlight this row as a key differentiator */
  highlight?: boolean;
}

interface ComparisonTableProps {
  incumbentName: string;
  rows: ComparisonRow[];
}

export function ComparisonTable({ incumbentName, rows }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
              Feature
            </th>
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
              {incumbentName}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">
              VitalCV
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.feature}
              className={`border-b border-border last:border-b-0 ${
                row.highlight
                  ? 'bg-trust-green/5'
                  : 'even:bg-card/50'
              }`}
            >
              <td className="px-4 py-3 font-medium">{row.feature}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {row.incumbent}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {row.vitalcv}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
