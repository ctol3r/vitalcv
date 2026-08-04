/* VitalCV · global tunnel telemetry bar (Wave D33)
   Fixed bottom strip, ~22px tall. Degrades to amber when latency spikes.
   Single source of truth — include via <script src="telemetry.js"></script> on demo pages. */
(function () {
  if (document.querySelector('.vc-tele')) return; // idempotent

  const style = document.createElement('style');
  style.textContent = `
    .vc-tele{position:fixed;bottom:0;left:0;right:0;height:22px;background:#000;color:#94a3b8;border-top:1px solid #1e293b;font-family:'Geist Mono','SF Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;display:flex;align-items:center;justify-content:space-between;padding:0 18px;z-index:60;-webkit-font-smoothing:antialiased;}
    .vc-tele.degraded{background:#1a1004;color:#fbbf24;border-top-color:#a16207;}
    .vc-tele .cell{display:flex;gap:8px;align-items:center;white-space:nowrap;}
    .vc-tele .dot{width:6px;height:6px;background:#10b981;border-radius:50%;animation:vc-pulse 2s ease-in-out infinite;flex-shrink:0;}
    .vc-tele.degraded .dot{background:#fbbf24;animation-duration:.9s;}
    @keyframes vc-pulse{0%,100%{opacity:.35;}50%{opacity:1;}}
    .vc-tele strong{color:#fff;font-weight:600;letter-spacing:.08em;}
    .vc-tele.degraded strong{color:#fde047;}
    .vc-tele .sep{color:#334155;}
    .vc-tele.degraded .sep{color:#78350f;}
    .vc-tele .v{color:#cbd5e1;font-weight:500;letter-spacing:.04em;}
    .vc-tele.degraded .v{color:#fcd34d;}
    body.vc-tele-pad{padding-bottom:22px;}
    @media(max-width:980px){.vc-tele .x-mid{display:none;}}
    @media(max-width:640px){.vc-tele .x-md{display:none;}.vc-tele{font-size:9.5px;padding:0 10px;letter-spacing:.04em;}}
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.className = 'vc-tele';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-label', 'Tunnel telemetry');
  bar.innerHTML = `
    <div class="cell">
      <span class="dot"></span>
      <strong id="vc-tele-label">SECURE LOCAL TUNNEL ACTIVE</strong>
      <span class="sep">·</span>
      <span class="v" id="vc-tele-host">cedar-pilot.trycloudflare.com</span>
      <span class="sep x-md">·</span>
      <span class="x-md">tls <span class="v">1.3</span></span>
    </div>
    <div class="cell x-mid">
      <span>node</span><span class="v">vc-edge-us-west-2a</span>
      <span class="sep">·</span>
      <span>region</span><span class="v">us-west-2</span>
      <span class="sep">·</span>
      <span>sources</span><span class="v" id="vc-tele-src">NPPES · OIG · PECOS</span>
    </div>
    <div class="cell">
      <span class="x-md">latency</span>
      <span class="v"><span id="vc-tele-lat">12</span> ms</span>
      <span class="sep">·</span>
      <span>p95</span><span class="v"><span id="vc-tele-p95">38</span> ms</span>
      <span class="sep x-md">·</span>
      <span class="x-md">build</span><span class="x-md v">vc.2026.05.11-a</span>
    </div>
  `;
  document.body.appendChild(bar);
  document.body.classList.add('vc-tele-pad');

  const latEl = bar.querySelector('#vc-tele-lat');
  const p95El = bar.querySelector('#vc-tele-p95');
  const labelEl = bar.querySelector('#vc-tele-label');
  const srcEl = bar.querySelector('#vc-tele-src');

  let degraded = false;
  let recoveryCountdown = 0;
  const samples = [];
  function tick() {
    const r = Math.random();
    let lat;
    if (r < 0.90) lat = 10 + Math.floor(Math.random() * 8);
    else if (r < 0.98) lat = 28 + Math.floor(Math.random() * 50);
    else lat = 160 + Math.floor(Math.random() * 180);

    samples.push(lat);
    if (samples.length > 40) samples.shift();
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || lat;

    latEl.textContent = lat;
    p95El.textContent = p95;

    if (lat > 120 && !degraded) {
      degraded = true;
      bar.classList.add('degraded');
      labelEl.textContent = 'UPSTREAM DEGRADED · PECOS';
      srcEl.textContent = 'NPPES · OIG · PECOS↓';
      recoveryCountdown = 5;
    } else if (degraded) {
      recoveryCountdown--;
      if (recoveryCountdown <= 0 && lat < 30) {
        degraded = false;
        bar.classList.remove('degraded');
        labelEl.textContent = 'SECURE LOCAL TUNNEL ACTIVE';
        srcEl.textContent = 'NPPES · OIG · PECOS';
      }
    }
  }
  tick();
  setInterval(tick, 1800);
})();
