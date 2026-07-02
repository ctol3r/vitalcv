// ════════════════════════════════════════════════════════════════════════
// OPPORTUNITY NETWORK — app shell + hash router
// Routes: #/opportunities · #/opportunities/[id] · /next · /growth
// ════════════════════════════════════════════════════════════════════════

function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (h === '/opportunities/next')   return { view: 'recommend' };
  if (h === '/opportunities/growth') return { view: 'growth' };
  const m = h.match(/^\/opportunities\/([^/]+)$/);
  if (m) return { view: 'detail', id: m[1] };
  if (h === '/opportunities' || h === '') {
    try { const s = localStorage.getItem('vcv.opp.route'); if (s) return JSON.parse(s); } catch (_) {}
    return { view: 'home' };
  }
  return { view: 'home' };
}

function hashFor(state) {
  if (state.view === 'recommend') return '/opportunities/next';
  if (state.view === 'growth')    return '/opportunities/growth';
  if (state.view === 'detail')    return '/opportunities/' + state.id;
  return '/opportunities';
}

const VIEW_TO_NAV = { home: 'home', detail: 'detail', recommend: 'recommend', growth: 'growth' };

function OppApp() {
  const [state, setState] = React.useState(parseHash);

  React.useEffect(() => {
    const onHash = () => setState(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next) => {
    setState(next);
    try { localStorage.setItem('vcv.opp.route', JSON.stringify(next)); } catch (_) {}
    const target = '#' + hashFor(next);
    if (location.hash !== target) history.pushState(null, '', target);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const main = document.getElementById('opp-main');
    if (main) main.scrollTop = 0;
  };

  const navTo = (id) => go({ view: id });
  const openOpp = (id) => go({ view: 'detail', id });
  const back = () => go({ view: 'home' });

  React.useEffect(() => {
    if (location.hash !== '#' + hashFor(state)) history.replaceState(null, '', '#' + hashFor(state));
  }, []);

  const activeNav = VIEW_TO_NAV[state.view] || 'home';

  let body;
  if (state.view === 'detail')         body = <ViewDetail id={state.id} onOpen={openOpp} onNav={navTo} onBack={back} />;
  else if (state.view === 'recommend') body = <ViewRecommend onNav={navTo} />;
  else if (state.view === 'growth')    body = <ViewGrowth onNav={navTo} onOpen={openOpp} />;
  else                                 body = <ViewHome onOpen={openOpp} onNav={navTo} />;

  return (
    <div className="flex min-h-screen bg-[#f7f8fa]">
      <Sidebar active={activeNav} onNav={navTo} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* scenario strip */}
        <div className="bg-slate-900 text-slate-300 text-[11px] sticky top-0 z-30">
          <div className="px-6 lg:px-9 h-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="mono uppercase tracking-[0.14em] text-slate-400">Opportunity Network</span>
              <span className="text-slate-600">·</span>
              <span className="hidden sm:inline">Wave 270 · evidence creates opportunity</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="hidden md:inline">Env <span className="mono text-slate-200">sandbox</span></span>
              <span className="h-3 w-px bg-slate-700 hidden md:inline-block" />
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-soft" /><span className="mono text-slate-300">projected live</span></span>
            </div>
          </div>
        </div>

        <MobileNav active={activeNav} onNav={navTo} />

        <main id="opp-main" className="flex-1 px-6 lg:px-9 py-8 max-w-[1180px] w-full mx-auto">
          {body}
          <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 mono text-[10.5px] uppercase tracking-[0.1em] text-slate-400">
            <span>VitalCV · Opportunity Network · {W.CLINICIAN.walletId}</span>
            <span>Readiness projected from owned evidence · <span className="text-slate-600">never a stored match</span></span>
          </footer>
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<OppApp />);
