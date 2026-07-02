// WAVE 1300 — CONFIG STORE
// The operating system's spine. Holds the active workspace and every live,
// editable override (stages, dashboard layout, automation rules, role caps),
// seeded from the workspace defaults and persisted to localStorage. Surfaces
// subscribe with useStore(); editing here re-renders the whole product.

const W13_KEY = 'vitalcv.w1300.config.v1';

function seedConfig() {
  const ws = {};
  WORKSPACES.forEach(w => {
    const caps = {};
    w.roleIds.forEach(rid => { caps[rid] = [...(DEFAULT_CAPS[rid] || [])]; });
    ws[w.id] = {
      terms: { ...w.terms },
      stages: w.stages.map(s => ({ ...s })),
      dashboard: [...w.dashboard],
      automations: w.automations.map(a => ({ ...a })),
      caps,
      roleIds: [...w.roleIds],
    };
  });
  return { activeWs: WORKSPACES[0].id, activeRole: null, ws };
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(W13_KEY);
    if (!raw) return seedConfig();
    const saved = JSON.parse(raw);
    const base = seedConfig();
    // shallow-merge so new workspaces in code still appear
    return {
      activeWs: saved.activeWs && base.ws[saved.activeWs] ? saved.activeWs : base.activeWs,
      activeRole: saved.activeRole || null,
      ws: { ...base.ws, ...(saved.ws || {}) },
    };
  } catch (e) { return seedConfig(); }
}

const Store = {
  state: loadConfig(),
  listeners: new Set(),
  getSnapshot() { return Store.state; },
  subscribe(fn) { Store.listeners.add(fn); return () => Store.listeners.delete(fn); },
  emit() {
    try { localStorage.setItem(W13_KEY, JSON.stringify(Store.state)); } catch (e) {}
    Store.listeners.forEach(fn => fn());
  },
  set(next) {
    Store.state = typeof next === 'function' ? next(Store.state) : { ...Store.state, ...next };
    Store.emit();
  },
  // mutate the active workspace's config slice
  patchWs(wsId, patch) {
    Store.set(s => ({
      ...s,
      ws: { ...s.ws, [wsId]: { ...s.ws[wsId], ...(typeof patch === 'function' ? patch(s.ws[wsId]) : patch) } },
    }));
  },
  reset() { localStorage.removeItem(W13_KEY); Store.state = seedConfig(); Store.emit(); },
};
window.Store = Store;

function useStore() {
  return React.useSyncExternalStore(Store.subscribe, Store.getSnapshot);
}
window.useStore = useStore;

// Active workspace definition + live config, merged for convenience.
function useWorkspace() {
  const s = useStore();
  const def = WORKSPACES.find(w => w.id === s.activeWs) || WORKSPACES[0];
  const cfg = s.ws[def.id];
  return { def, cfg, terms: (cfg && cfg.terms) || def.terms, accent: def.accent, activeRole: s.activeRole };
}
window.useWorkspace = useWorkspace;

// Apply the active workspace accent to a CSS variable so the whole theme follows.
function useAccentTheme(accent) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', hexA(accent, 0.12));
    root.style.setProperty('--accent-ring', hexA(accent, 0.30));
    root.style.setProperty('--accent-glow', hexA(accent, 0.06));
  }, [accent]);
}
window.useAccentTheme = useAccentTheme;

// Deterministic per-stage volume so funnels/cohorts feel real and stable.
function stageVolume(wsId, stageIdx, total) {
  let h = 0; const key = wsId + ':' + stageIdx;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const decay = Math.pow(0.62, stageIdx);
  const jitter = 0.85 + (h % 30) / 100;
  return Math.max(3, Math.round(total * decay * jitter / 10));
}
window.stageVolume = stageVolume;
