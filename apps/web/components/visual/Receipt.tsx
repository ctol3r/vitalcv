import * as React from 'react';

export type ReceiptLine = { k: React.ReactNode; v: React.ReactNode };

/**
 * Static receipt block — paper-and-ink receipt aesthetic with the
 * diagonal-stripe top edge. Used inline on /passport and inside the
 * Receipt Drawer.
 */
export function Receipt({
  lines,
  signature,
  style,
}: {
  lines: ReceiptLine[];
  signature?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="vs-receipt" style={style}>
      {lines.map((line, index) => (
        <div key={index} className="vs-ln">
          <span className="vs-k">{line.k}</span>
          <span className="vs-v">{line.v}</span>
        </div>
      ))}
      {signature ? <div className="vs-sig">{signature}</div> : null}
    </div>
  );
}
