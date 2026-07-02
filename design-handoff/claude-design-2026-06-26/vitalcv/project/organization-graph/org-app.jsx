// ════════════════════════════════════════════════════════════════════════
// ORGANIZATION GRAPH — app shell + hash router
// Routes: #/organizations/[id]{,/timeline,/trust,/graph,/opportunities[/req]}
// ════════════════════════════════════════════════════════════════════════

const DEFAULT_ORG = 'cedar-health';

function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  let m;
  if ((m = h.match(/^\/organizations\/([^/]+)\/opportunities\/([^/]+)$/))) return { org: m[1], view: 'container', id: m[2] };
  if ((m = h.match(/^\/organizations\/([^/]+)\/(timeline|trust|graph|opportunities)$/))) {
    const map = { timeline: 'timeline', trust: 'trust', graph: 'graph', opportunities: 'opportunities' };
    return { org: m[1], view: map[m[2]] };
  }
  if ((m = h.match(/^\/organizations\/([^/]+)$/))) return { org: m[1], view: 'profile' };
  if (h === '' || h === '/') {
    try { const s = localStorage.getItem('vcv.org.route'); if (s) return JSON.parse(s); } catch (_) {}
    return { org: DEFAULT_ORG, view: 'profile' };
  }
  return { org: DEFAULT_ORG, view: 'profile' };
}

function hashFor(s) {
  const base = '/organizations/' + (s.org || DEFAULT_ORG);
  if (s.view === 'container')    return base + '/opportunities/' + s.id;
  if (s.view === 'timeline')     return base + '/timeline';
  if (s.view === 'trust')        return base + '/trust';
  if (s.view === 'graph')        return base + '/graph';
  if (s.view === 'opportunities')return base + '/opportunities';
  return base;
}

const VIEW_TO_NAV = { profile: 'profile', timeline: 'timeline', trust: 'trust', graph: 'graph', opportunities: 'opportunities', container: 'container' };

function OrgApp() {
  const [state, setState] = React.useState(parseHash);

  React.useEffect(() => {
    const onHash = () => setState(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next) => {
    const merged = { org: state.org || DEFAULT_ORG, ...next };
    setState(merged);
    try { localStorage.setItem('vcv.org.route', JSON.stringify(merged)); } catch (_) {}
    const target = '#' + hashFor(merged);
    if (location.hash !== target) history.pushState(null, '', target);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const main = document.getElementById('org-main');
    if (main) main.scrollTop = 0;
  };

  const navTo = (id) => go({ view: id });
  const openContainer = (id) => go({ view: 'container', id });
  const backToOpps = () => go({ view: 'opportunities' });

  React.useEffect(() => {
    if (location.hash !== '#' + hashFor(state)) history.replaceState(null, '', '#' + hashFor(state));
  }, []);

  const org = G.byId(state.org) || G.focal();
  const activeNav = VIEW_TO_NAV[state.view] || 'profile';

  let body;
  if (state.view === 'timeline')           body = <ViewTimeline org={org} onNav={navTo} />;
  else if (state.view === 'trust')         body = <ViewTrust org={org} onNav={navTo} />;
  else if (state.view === 'graph')         body = <ViewGraph org={org} onNav={navTo} onOpen={openContainer} />;
  else if (state.view === 'opportunities') body = <ViewOpportunities org={org} onOpen={openContainer} onNav={navTo} />;
  else if (state.view === 'container')     body = <ViewContainer org={org} id={state.id} onOpen={openContainer} onNav={navTo} onBack={backToOpps} />;
  else                                     body = <ViewProfile org={org} onNav={navTo} onOpen={openContainer} />;

  return (
    <div className="flex min-h-screen bg-[#f7f8fa]">
      <Sidebar org={org} active={activeNav} onNav={navTo} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* scenario strip */}
        <div className="bg-slate-900 text-slate-300 text-[11px] sticky top-0 z-30">
          <div className="px-6 lg:px-9 h-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="mono uppercase tracking-[0.14em] text-slate-400">Organization Graph</span>
              <span className="text-slate-600">·</span>
              <span className="hidden sm:inline">Wave 265 · organizations are first-class</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="hidden md:inline">Env <span className="mono text-slate-200">sandbox</span></span>
              <span className="h-3 w-px bg-slate-700 hidden md:inline-block" />
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-soft" /><span className="mono text-slate-300">verified live</span></span>
            </div>
          </div>
        </div>

        <MobileNav active={activeNav} onNav={navTo} />

        <main id="org-main" className="flex-1 px-6 lg:px-9 py-8 max-w-[1180px] w-full mx-auto">
          {body}
          <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 mono text-[10.5px] uppercase tracking-[0.1em] text-slate-400">
            <span>VitalCV · Organization Graph · {org.identity ? org.identity.orgNpi : org.orgNpi}</span>
            <span>Relationships, never matches · <span className="text-slate-600">containers stay declarations</span></span>
          </footer>
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<OrgApp />);
