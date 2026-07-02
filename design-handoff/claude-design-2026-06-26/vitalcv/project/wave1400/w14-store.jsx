// WAVE 1400 — OPERATIONS STORE · the immutable operational ledger
// This is the heartbeat of the engine. It holds the live roster for every
// workspace and an APPEND-ONLY log of operational events. Every action a user
// takes in the Command Center (assign, resolve, approve, escalate, advance)
// mutates the roster AND writes an immutable event — the same events the
// Timeline replays and the Operations / Executive surfaces aggregate. A
// real-time heartbeat appends synthetic field activity so the system is always
// observably moving, exactly as a production operations layer would be.

const W14_KEY = 'vitalcv.w1400.ops.v3';
let _seq = 1;
const nextSeq = () => _seq++;

function mkEvent({ type, ts, actor, subjectId, subject, group, detail, system }) {
  return Object.freeze({
    id: 'e' + nextSeq() + '-' + Math.floor(ts).toString(36),
    seq: _seq,
    ts, type, actor: actor || null,
    subjectId: subjectId || null, subject: subject || null, group: group || null,
    detail: detail || '', system: !!system,
  });
}

// Deterministic seed history for a workspace — ~10 days of prior operations.
function seedEvents(ws, roster) {
  const r = rng(hashStr('w1400:ev:' + ws.id));
  const now = Date.now();
  const types = ['evidence_submitted','verification_done','recruiter_assigned','interview_done','offer_issued','offer_accepted','evidence_approved','blocker_resolved','stage_advanced','org_notified','recognition_updated'];
  const evs = [];
  const count = 34;
  for (let i = 0; i < count; i++) {
    const p = roster[Math.floor(r() * roster.length)];
    const t = types[Math.floor(r() * types.length)];
    const ts = now - (i * (5 + Math.floor(r() * 9))) * 60000 - Math.floor(r() * 3600000);
    const owner = ws.stages[p.stageIdx] ? ws.stages[p.stageIdx].owner : 'credentialing';
    const actor = (TEAM.filter(u => u.role === owner)[0] || TEAM[Math.floor(r() * TEAM.length)]).id;
    evs.push(mkEvent({ type: t, ts, actor, subjectId: p.id, subject: p.name, group: p.group, detail: detailFor(t, p, ws), system: true }));
  }
  evs.sort((a, b) => b.ts - a.ts);
  return evs;
}

function detailFor(type, p, ws) {
  const stage = ws.stages[p.stageIdx] ? ws.stages[p.stageIdx].label : '—';
  switch (type) {
    case 'evidence_submitted':  return `${p.specialty} · primary-source packet received`;
    case 'verification_done':   return `License & NPI verified against registry`;
    case 'recruiter_assigned':  return `Routed into ${stage}`;
    case 'work_assigned':       return `Assigned in ${stage}`;
    case 'interview_done':      return `${p.group} panel recorded a decision`;
    case 'offer_issued':        return `Offer sent · ${p.specialty}`;
    case 'offer_accepted':      return `Signed — onboarding can begin`;
    case 'evidence_approved':   return `Readiness conferred by credentialing`;
    case 'blocker_resolved':    return `Verification gate cleared`;
    case 'stage_advanced':      return `Now in ${stage}`;
    case 'issue_escalated':     return `Raised to leadership for attention`;
    case 'recognition_updated': return `Professional Trust profile refreshed`;
    case 'org_notified':        return `${ws.short} notified of status change`;
    case 'readiness_changed':   return `Readiness now ${p.readiness}%`;
    default: return stage;
  }
}
window.detailFor = detailFor;

function seedState() {
  const ws = {};
  WORKSPACES.forEach(w => {
    const roster = genRoster(w);
    ws[w.id] = { roster, events: seedEvents(w, roster) };
  });
  return { activeWs: WORKSPACES[0].id, ws, live: true, _v: 3 };
}

function loadState() {
  try {
    const raw = localStorage.getItem(W14_KEY);
    if (!raw) return seedState();
    const saved = JSON.parse(raw);
    if (!saved || saved._v !== 3 || !saved.ws) return seedState();
    // recompute max seq so new events keep climbing
    let maxSeq = 1;
    Object.values(saved.ws).forEach(s => (s.events || []).forEach(e => { if (e.seq > maxSeq) maxSeq = e.seq; }));
    _seq = maxSeq + 1;
    return saved;
  } catch (e) { return seedState(); }
}

const Store = {
  state: loadState(),
  listeners: new Set(),
  getSnapshot() { return Store.state; },
  subscribe(fn) { Store.listeners.add(fn); return () => Store.listeners.delete(fn); },
  emit() {
    try { localStorage.setItem(W14_KEY, JSON.stringify(Store.state)); } catch (e) {}
    Store.listeners.forEach(fn => fn());
  },
  set(next) {
    Store.state = typeof next === 'function' ? next(Store.state) : { ...Store.state, ...next };
    Store.emit();
  },
  reset() { localStorage.removeItem(W14_KEY); _seq = 1; Store.state = seedState(); Store.emit(); },

  // --- helpers ---
  wsSlice(id) { return Store.state.ws[id || Store.state.activeWs]; },

  // Append an immutable event to the active (or given) workspace ledger.
  log(evt, wsId) {
    const id = wsId || Store.state.activeWs;
    const e = mkEvent({ ts: Date.now(), ...evt });
    Store.set(s => ({
      ...s,
      ws: { ...s.ws, [id]: { ...s.ws[id], events: [e, ...s.ws[id].events].slice(0, 400) } },
    }));
    return e;
  },

  // Mutate one record in the active workspace roster, returning the patched record.
  patchRecord(pid, patch) {
    const id = Store.state.activeWs;
    Store.set(s => {
      const slice = s.ws[id];
      const roster = slice.roster.map(p => p.id === pid ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p);
      return { ...s, ws: { ...s.ws, [id]: { ...slice, roster } } };
    });
    return Store.wsSlice(id).roster.find(p => p.id === pid);
  },
};
window.Store = Store;

/* ---------- The operational actions — each writes an immutable event ---------- */
const recalcRisk = (p) => {
  const hasHigh = p.blockers.some(id => (BLOCKERS.find(b => b.id === id) || {}).sev === 'high');
  if (hasHigh || p.readiness < 50) return 'high';
  if (p.blockers.length || p.overdue || p.readiness < 72) return 'med';
  return 'low';
};

const Ops = {
  assignWork(p, userId, actorId) {
    const u = TEAM.find(t => t.id === userId);
    Store.patchRecord(p.id, { assignee: userId });
    Store.log({ type: 'work_assigned', actor: actorId || userId, subjectId: p.id, subject: p.name, group: p.group, detail: `Assigned to ${u ? u.name : 'team'}` });
  },
  approveEvidence(p, actorId) {
    const next = Store.patchRecord(p.id, q => ({ readiness: Math.min(100, q.readiness + 8) }));
    Store.patchRecord(p.id, q => ({ risk: recalcRisk(q) }));
    Store.log({ type: 'evidence_approved', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: `Readiness conferred · now ${next.readiness}%` });
  },
  resolveBlocker(p, blockerId, actorId) {
    const b = BLOCKERS.find(x => x.id === blockerId);
    const next = Store.patchRecord(p.id, q => ({ blockers: q.blockers.filter(id => id !== blockerId), readiness: Math.min(100, q.readiness + 4) }));
    Store.patchRecord(p.id, q => ({ risk: recalcRisk(q) }));
    Store.log({ type: 'blocker_resolved', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: b ? b.label : 'Blocker cleared' });
  },
  escalate(p, actorId) {
    Store.patchRecord(p.id, { flagged: true });
    Store.log({ type: 'issue_escalated', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: 'Raised to leadership attention queue' });
    Store.log({ type: 'org_notified', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: 'Leadership notified' });
  },
  advanceStage(p, ws, actorId) {
    const last = ws.stages.length - 1;
    if (p.stageIdx >= last) return;
    const nextIdx = p.stageIdx + 1;
    const stage = ws.stages[nextIdx];
    const next = Store.patchRecord(p.id, {
      stageIdx: nextIdx, isActive: nextIdx === last, daysInStage: 0, overdue: false,
      sla: stage.sla || 0, owner: stage.owner,
      readiness: Math.min(100, p.readiness + 6),
    });
    Store.patchRecord(p.id, q => ({ risk: recalcRisk(q) }));
    Store.log({ type: 'stage_advanced', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: `Now in ${stage.label}` });
    if (nextIdx === last) Store.log({ type: 'recognition_updated', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: 'Professional Trust profile activated' });
  },
};
window.Ops = Ops;

/* ---------- Subscriptions ---------- */
function useStore() { return React.useSyncExternalStore(Store.subscribe, Store.getSnapshot); }
window.useStore = useStore;

function useWorkspace() {
  const s = useStore();
  const def = WORKSPACES.find(w => w.id === s.activeWs) || WORKSPACES[0];
  const slice = s.ws[def.id];
  return { def, slice, roster: slice.roster, events: slice.events, terms: def.terms, accent: def.accent, live: s.live };
}
window.useWorkspace = useWorkspace;

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

/* ---------- Real-time heartbeat — synthetic field activity ---------- */
// Generates a plausible operational event every few seconds so the engine is
// always observably moving. Pausable from the chrome (Store.state.live).
const HEARTBEAT_TYPES = ['evidence_submitted','verification_done','interview_done','readiness_changed','org_notified','recognition_updated'];
function startHeartbeat() {
  let t = 0;
  const tick = () => {
    const s = Store.state;
    if (s.live) {
      const wsId = s.activeWs;
      const def = WORKSPACES.find(w => w.id === wsId);
      const slice = s.ws[wsId];
      if (def && slice && slice.roster.length) {
        const r = rng((Date.now() & 0xffffff) ^ hashStr(wsId));
        const p = slice.roster[Math.floor(r() * slice.roster.length)];
        const type = HEARTBEAT_TYPES[Math.floor(r() * HEARTBEAT_TYPES.length)];
        if (type === 'readiness_changed' && !p.isActive) {
          const next = Store.patchRecord(p.id, q => ({ readiness: Math.max(10, Math.min(100, q.readiness + (r() < 0.6 ? 1 : -1) * (1 + Math.floor(r() * 3)))) }));
          Store.log({ type, actor: null, subjectId: p.id, subject: p.name, group: p.group, detail: `Readiness now ${next.readiness}%`, system: true });
        } else {
          Store.log({ type, actor: null, subjectId: p.id, subject: p.name, group: p.group, detail: detailFor(type, p, def), system: true });
        }
      }
    }
    t = setTimeout(tick, 5200 + Math.random() * 3200);
  };
  t = setTimeout(tick, 4000);
}
window.startHeartbeat = startHeartbeat;
