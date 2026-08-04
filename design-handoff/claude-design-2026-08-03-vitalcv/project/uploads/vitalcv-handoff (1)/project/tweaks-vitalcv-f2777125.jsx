/* VitalCV Tweaks — minimal/noise/animations
   Mounts a Tweaks panel and applies CSS-variable + class-driven knobs at the <html> root,
   so individual component files don't need edits.
*/
(function () {
  const { useEffect } = React;
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "noise": "calm",
    "density": "comfortable",
    "rounded": "soft",
    "borders": "hairline",
    "chips": "muted",
    "shadows": "flat",
    "monoChrome": false,
    "anim": "modern",
    "animSpeed": 1,
    "reduceMotion": false,
    "hoverLift": true,
    "stagger": true
  }/*EDITMODE-END*/;

  function applyTweaks(t) {
    const html = document.documentElement;

    // Density → spacing & font scale
    const densityMap = {
      cozy:        { pad: 0.85, font: 0.95, gap: 0.85 },
      comfortable: { pad: 1.00, font: 1.00, gap: 1.00 },
      airy:        { pad: 1.15, font: 1.04, gap: 1.18 },
    };
    const d = densityMap[t.density] || densityMap.comfortable;
    html.style.setProperty('--tw-pad', d.pad);
    html.style.setProperty('--tw-font', d.font);
    html.style.setProperty('--tw-gap', d.gap);

    // Rounded
    const radiusMap = { sharp: '2px', soft: '8px', round: '14px' };
    html.style.setProperty('--tw-radius', radiusMap[t.rounded] || radiusMap.soft);

    // Borders
    const borderMap = { hairline: '0.5px', thin: '1px', none: '0px' };
    html.style.setProperty('--tw-border', borderMap[t.borders] || '1px');

    // Animation speed (multiplier of base durations)
    const spd = Math.max(0.25, Math.min(2.5, Number(t.animSpeed) || 1));
    html.style.setProperty('--tw-spd', String(1 / spd)); // higher slider = faster
    html.style.setProperty('--tw-dur-fast', `${Math.round(140 / spd)}ms`);
    html.style.setProperty('--tw-dur', `${Math.round(260 / spd)}ms`);
    html.style.setProperty('--tw-dur-slow', `${Math.round(440 / spd)}ms`);

    // Toggle classes on <html>
    html.classList.toggle('tw-noise-calm', t.noise === 'calm');
    html.classList.toggle('tw-noise-quiet', t.noise === 'quiet');
    html.classList.toggle('tw-noise-mute', t.noise === 'mute');

    html.classList.toggle('tw-chips-muted', t.chips === 'muted');
    html.classList.toggle('tw-chips-mono', t.chips === 'mono');
    html.classList.toggle('tw-chips-color', t.chips === 'color');

    html.classList.toggle('tw-flat', t.shadows === 'flat');
    html.classList.toggle('tw-mono', !!t.monoChrome);

    html.classList.toggle('tw-anim-modern', t.anim === 'modern');
    html.classList.toggle('tw-anim-snappy', t.anim === 'snappy');
    html.classList.toggle('tw-anim-soft',   t.anim === 'soft');
    html.classList.toggle('tw-anim-off',    t.anim === 'off' || t.reduceMotion);

    html.classList.toggle('tw-hover-lift', !!t.hoverLift && !t.reduceMotion && t.anim !== 'off');
    html.classList.toggle('tw-stagger',    !!t.stagger    && !t.reduceMotion && t.anim !== 'off');
    html.classList.toggle('tw-reduce-motion', !!t.reduceMotion);
  }

  function VitalCVTweaks() {
    const tp = window.useTweaks(TWEAK_DEFAULTS);
    const t = tp[0]; const setTweak = tp[1];

    useEffect(() => { applyTweaks(t); }, [t]);

    return (
      <window.TweaksPanel title="Tweaks" subtitle="Less noise · modern motion">

        <window.TweakSection title="Noise">
          <window.TweakRadio
            label="Surface noise"
            value={t.noise}
            onChange={(v) => setTweak('noise', v)}
            options={[
              { value: 'calm',  label: 'Calm' },
              { value: 'quiet', label: 'Quiet' },
              { value: 'mute',  label: 'Mute' },
            ]}
          />
          <window.TweakRadio
            label="Chips"
            value={t.chips}
            onChange={(v) => setTweak('chips', v)}
            options={[
              { value: 'color', label: 'Color' },
              { value: 'muted', label: 'Muted' },
              { value: 'mono',  label: 'Mono' },
            ]}
          />
          <window.TweakToggle
            label="Monochrome everything"
            checked={!!t.monoChrome}
            onChange={(v) => setTweak('monoChrome', v)}
          />
        </window.TweakSection>

        <window.TweakSection title="Layout">
          <window.TweakRadio
            label="Density"
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'cozy',        label: 'Cozy' },
              { value: 'comfortable', label: 'Comfort' },
              { value: 'airy',        label: 'Airy' },
            ]}
          />
          <window.TweakRadio
            label="Corners"
            value={t.rounded}
            onChange={(v) => setTweak('rounded', v)}
            options={[
              { value: 'sharp', label: 'Sharp' },
              { value: 'soft',  label: 'Soft' },
              { value: 'round', label: 'Round' },
            ]}
          />
          <window.TweakRadio
            label="Borders"
            value={t.borders}
            onChange={(v) => setTweak('borders', v)}
            options={[
              { value: 'none',     label: 'None' },
              { value: 'hairline', label: 'Hair' },
              { value: 'thin',     label: 'Thin' },
            ]}
          />
          <window.TweakRadio
            label="Shadows"
            value={t.shadows}
            onChange={(v) => setTweak('shadows', v)}
            options={[
              { value: 'flat',   label: 'Flat' },
              { value: 'subtle', label: 'Subtle' },
            ]}
          />
        </window.TweakSection>

        <window.TweakSection title="Motion">
          <window.TweakRadio
            label="Animation style"
            value={t.anim}
            onChange={(v) => setTweak('anim', v)}
            options={[
              { value: 'modern', label: 'Modern' },
              { value: 'snappy', label: 'Snappy' },
              { value: 'soft',   label: 'Soft' },
              { value: 'off',    label: 'Off' },
            ]}
          />
          <window.TweakSlider
            label="Speed"
            value={t.animSpeed}
            min={0.5} max={2} step={0.05}
            onChange={(v) => setTweak('animSpeed', v)}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <window.TweakToggle
            label="Hover lift on cards & rows"
            checked={!!t.hoverLift}
            onChange={(v) => setTweak('hoverLift', v)}
          />
          <window.TweakToggle
            label="Stagger entry on lists"
            checked={!!t.stagger}
            onChange={(v) => setTweak('stagger', v)}
          />
          <window.TweakToggle
            label="Reduce motion (overrides all)"
            checked={!!t.reduceMotion}
            onChange={(v) => setTweak('reduceMotion', v)}
          />
        </window.TweakSection>

      </window.TweaksPanel>
    );
  }

  // Mount alongside existing app
  function mount() {
    if (!window.TweaksPanel || !window.useTweaks) {
      // tweaks-panel.jsx not yet loaded; retry next tick
      return setTimeout(mount, 30);
    }
    let host = document.getElementById('vitalcv-tweaks-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vitalcv-tweaks-root';
      document.body.appendChild(host);
    }
    ReactDOM.createRoot(host).render(<VitalCVTweaks />);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
