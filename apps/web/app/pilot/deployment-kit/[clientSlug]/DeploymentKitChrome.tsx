'use client';

import * as React from 'react';
import styles from './deployment-kit.module.css';

/**
 * Screen-only top chrome: monospace path crumb on the left, live UTC
 * clock + "Print to PDF" button on the right. Mirrors the original
 * `<div class="chrome">` from the design.
 *
 * Print stylesheet hides the chrome entirely (`@media print` rule in
 * the CSS module).
 */
export function DeploymentKitChrome({
  docNumber,
  path,
}: {
  docNumber: string;
  path: string;
}) {
  const [clock, setClock] = React.useState<string>(() => formatUtc(new Date()));

  React.useEffect(() => {
    const tick = () => setClock(formatUtc(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.chrome}>
      <div className={styles.chromeInner}>
        <div className={styles.chromeLeft}>
          <span className={styles.glyph}>V</span>
          <strong>VitalCV</strong>
          <span className={styles.path}>{path}</span>
        </div>
        <div className={styles.chromeRight}>
          <span>Doc · {docNumber}</span>
          <span className={styles.clock} aria-live="off">
            {clock}
          </span>
          <button
            type="button"
            className={styles.print}
            onClick={() => window.print()}
          >
            Print to PDF →
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}
