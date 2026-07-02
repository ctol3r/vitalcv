// ════════════════════════════════════════════════════════════════════════
// WORKSPACE GRAPH — app shell + hash router
// Routes: #/workspace/[id]{,/organization,/clinicians,/activity}
// Person ↔ Workspace ↔ Organization ↔ Opportunity, in one experience.
// ════════════════════════════════════════════════════════════════════════

const DEFAULT_WS = 'cedar-ortho';

function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  let m;
  if ((m = h.match(/^\/workspace\/([^/]+)\/(organization|clinicians|activity)$/))) {
    const map = { organization: 'org', clinicians: 'clinician', activity: 'activity' };
    return { ws: m[1], view: map[m[2]] };
  }
  if ((m = h.match(/^\/workspace\/([^/]+)$/))) return { ws: m[1], view: 'home' };
  if (h === '' || h === '/') {
    try { const s = localStorage.getItem('vcv.ws.route'); if (s) return JSON.parse(s); } catch (_) {}
    return { ws: DEFAULT_WS, view: 'home' };
  }
  return { ws: DEFAULT_WS, view: 'home' };
}

function hashFor(s) {
  const base = '/workspace/' + (s.ws || DEFAULT_WS);
  if (s.view === 'org')       return base + '/organization';
  if (s.view === 'clinician') return base + '/clinicians';
  if (s.view === 'activity')  return base + '/activity';
  return base;
}

function WorkspaceApp() {
  const [state, setState] = React.useState(parseHash);

  React.useEffect(() => {
    const onHash = () => setState(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const commit = (next) => {
    setState(next);
    try { localStorage.setItem('vcv.ws.route', JSON.stringify(next)); } catch (_) {}
    const target = '#' + hashFor(next);
    if (location.hash !== target) history.pushState(null, '', target);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const main = document.getElementById('ws-main');
    if (main) main.scrollTop = 0;
  };

  const navTo = (view) => commit({ ws: state.ws || DEFAULT_WS, view });
  const switchWs = (wsId) => commit({ ws: wsId, view: state.view || 'home' });

  React.useEffect(() => {
    if (location.hash !== '#' + hashFor(state)) history.replaceState(null, '', '#' + hashFor(state));
  }, []);

  const ws = W.byId(state.ws);
  const active = state.view === 'org' ? 'org' : state.view === 'clinician' ? 'clinician' : state.view === 'activity' ? 'activity' : 'home';

  let body;
  if (state.view === 'org')            body = <ViewOrg ws={ws} onNav={navTo} />;
  else if (state.view === 'clinician') body = <ViewClinician ws={ws} onNav={navTo} />;
  else if (state.view === 'activity')  body = <ViewActivity ws={ws} onNav={navTo} />;
  else                                 body = <ViewHome ws={ws} onNav={navTo} />;

  const type = W.WS_TYPE[ws.type];

  return (
    <div className="flex min-h-screen bg-[#f7f8fa]">
      <Sidebar ws={ws} active={active} onNav={navTo} onSwitch={switchWs} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* scenario strip */}
        <div className="bg-slate-900 text-slate-300 text-[11px] sticky top-0 z-30">
          <div className="px-6 lg:px-9 h-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="mono uppercase tracking-[0.14em] text-slate-400">Workspace Graph</span>
              <span className="text-slate-600">·</span>
              <span className="hidden sm:inline">Wave 275 · the first multi-sided workspace</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="hidden md:inline">{type.label}</span>
              <span className="h-3 w-px bg-slate-700 hidden md:inline-block" />
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-soft" /><span className="mono text-slate-300">shared live</span></span>
            </div>
          </div>
        </div>

        <MobileNav active={active} onNav={navTo} />

        <main id="ws-main" className="flex-1 px-6 lg:px-9 py-8 max-w-[1180px] w-full mx-auto">
          {body}
          <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 mono text-[10.5px] uppercase tracking-[0.1em] text-slate-400">
            <span>VitalCV · Workspace Graph · {ws.id}</span>
            <span>Person ↔ Workspace ↔ Organization ↔ Opportunity · <span className="text-slate-600">one experience</span></span>
          </footer>
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<WorkspaceApp />);
