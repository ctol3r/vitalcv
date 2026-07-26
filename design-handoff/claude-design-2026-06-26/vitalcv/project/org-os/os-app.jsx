// ════════════════════════════════════════════════════════════════════════
// os-app.jsx — Organization OS shell · sidebar nav + hash routing
// ════════════════════════════════════════════════════════════════════════

const NAV = [
  { id: 'dashboard', path: '/org',            label: 'Dashboard',  sub: 'Is my workforce ready?', icon: Icon.Grid,          View: 'OrgDashboard' },
  { id: 'providers', path: '/org/providers',  label: 'Providers',  sub: 'Directory',              icon: Icon.Users,         View: 'ProviderDirectory' },
  { id: 'hiring',    path: '/org/hiring',      label: 'Hiring',     sub: 'Command center',         icon: Icon.Briefcase,     View: 'HiringCenter' },
  { id: 'workforce', path: '/org/workforce',   label: 'Workforce',  sub: 'Health',                 icon: Icon.Heart,         View: 'WorkforceHealth' },
  { id: 'analytics', path: '/org/analytics',   label: 'Analytics',  sub: 'Executive',              icon: Icon.BarChart,      View: 'ExecAnalytics' },
];

function pathToId(hash) {
  const h = (hash || '').replace(/^#/, '') || '/org';
  const match = NAV.slice().reverse().find(n => h === n.path || h.startsWith(n.path + '/'));
  return match ? match.id : 'dashboard';
}

function App() {
  const [view, setView] = React.useState(() => pathToId(window.location.hash));

  React.useEffect(() => {
    const onHash = () => setView(pathToId(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const nav = (id) => {
    const n = NAV.find(x => x.id === id);
    if (n) { window.location.hash = n.path; setView(id); window.scrollTo({ top: 0 }); }
  };

  const active = NAV.find(n => n.id === view) || NAV[0];
  const ViewComp = window[active.View];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      <aside className="w-[236px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-30">
        {/* brand */}
        <div className="px-5 h-16 flex items-center border-b border-slate-100">
          <a href="#/org" className="flex items-center gap-2.5 group">
            <span className="relative h-7 w-7">
              <span className="absolute inset-0 bg-slate-900 rounded-[6px]" />
              <svg viewBox="0 0 20 20" className="absolute inset-0 h-7 w-7 text-white p-0.5">
                <path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="leading-none">
              <div className="font-semibold tracking-[-0.01em] text-[14px] text-slate-900">VitalCV</div>
              <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400 mt-0.5">Organization OS</div>
            </div>
          </a>
        </div>

        {/* org switcher */}
        <div className="px-3 pt-3">
          <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-slate-200 hover:border-slate-300 transition-colors text-left">
            <div className="h-7 w-7 rounded-md bg-emerald-600/10 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Icon.Building size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-slate-900 truncate">{ORG.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{ORG.totalProviders} providers · 5 sites</div>
            </div>
            <Icon.ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
          </button>
        </div>

        {/* nav */}
        <nav className="px-3 pt-3 space-y-0.5 flex-1">
          {NAV.map(n => {
            const on = view === n.id;
            return (
              <button key={n.id} onClick={() => nav(n.id)}
                className={cx('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors text-left group',
                  on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
                <n.icon size={16} strokeWidth={2} className={on ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                <div className="min-w-0 flex-1">
                  <div className={cx('text-[13px] font-medium leading-tight', on ? 'text-white' : 'text-slate-800')}>{n.label}</div>
                </div>
                <span className={cx('mono text-[9px] uppercase tracking-[0.06em]', on ? 'text-white/50' : 'text-slate-300')}>{n.path}</span>
              </button>
            );
          })}
        </nav>

        {/* footer */}
        <div className="px-3 pb-4 mt-auto">
          <div className="px-2.5 py-2.5 rounded-md bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Live · synced {NOW_LABEL.split('·')[1].trim()}</span>
            </div>
            <div className="mono text-[9px] text-slate-400 mt-1.5 uppercase tracking-[0.08em]">w510 · extends · never modifies core</div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────── */}
      <div className="flex-1 ml-[236px] min-w-0 flex flex-col">
        {/* top bar */}
        <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-7">
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon.Building size={14} className="text-slate-400" />
            <span className="text-[12.5px] text-slate-400">{ORG.name}</span>
            <Icon.ChevronRight size={13} className="text-slate-300" />
            <span className="text-[13px] font-medium text-slate-900">{active.label}</span>
            <span className="mono text-[11px] text-slate-400 ml-1 hidden sm:inline">{active.path}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Search providers, NPI…" className="h-9 w-[220px] pl-8 pr-3 py-1.5 text-[12.5px] border border-slate-200 rounded-md focus:border-slate-900 focus:outline-none placeholder:text-slate-400 bg-slate-50 focus:bg-white" />
            </div>
            <button className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-900 relative">
              <Icon.Bell size={15} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block leading-tight">
                <div className="text-[12px] font-medium text-slate-900">Dana Okafor</div>
                <div className="text-[10.5px] text-slate-400">CMO · Meridian Health</div>
              </div>
              <div className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold">DO</div>
            </div>
          </div>
        </header>

        {/* view */}
        <main className="flex-1 px-7 py-7 max-w-[1320px] w-full mx-auto">
          {ViewComp ? <ViewComp onNav={nav} /> : <div className="text-slate-400">Loading…</div>}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
