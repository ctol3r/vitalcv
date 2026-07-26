// W245 — Career OS app shell. Clinician-first IA:
// #/career/:id  ·  #/career/:id/evidence  ·  #/career/:id/timeline  ·  #/career/:id/trust

const W245_SECTIONS = [
  { id: 'home',     label: 'Home',     sub: 'standing',  Icon: Icon.Compass },
  { id: 'evidence', label: 'Evidence', sub: 'what exists', Icon: Icon.FileText },
  { id: 'timeline', label: 'Timeline', sub: 'what happened', Icon: Icon.Book },
  { id: 'trust',    label: 'Trust',    sub: 'how trusted', Icon: Icon.ShieldCheck },
];

function parse245() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  // expect: career / :id / :section?
  const entityId = parts[1] || 'macie-miller';
  const section = parts[2] || 'home';
  return { entityId, section };
}
function go245(section, entityId = 'macie-miller') {
  window.location.hash = section === 'home' ? `#/career/${entityId}` : `#/career/${entityId}/${section}`;
}
window.go245 = go245;

function useRoute245() {
  const [route, setRoute] = React.useState(parse245);
  React.useEffect(() => {
    const on = () => { setRoute(parse245()); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function W245Chrome({ section, entityId, entity }) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Scenario bar */}
      <div className="bg-slate-950 text-slate-300 text-[11px]">
        <div className="max-w-[1340px] mx-auto px-6 h-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mono uppercase tracking-[0.16em] text-slate-500 font-medium">Career OS</span>
            <span className="text-slate-700">/</span>
            <span className="truncate">Subject <span className="mono text-white">{entity.fullName}</span> · NPI <span className="mono text-white">{entity.npi}</span></span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 blink" />ledger live</span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="mono">vc.2026.06.21 · w245</span>
          </div>
        </div>
      </div>
      {/* Brand + tabs */}
      <div className="max-w-[1340px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-7 min-w-0">
          <a href="#/career/macie-miller" className="flex items-center gap-2.5 group flex-shrink-0">
            <span className="relative h-5 w-5">
              <span className="absolute inset-0 bg-slate-900 rounded-[4px]" />
              <svg viewBox="0 0 20 20" className="absolute inset-0 text-white h-5 w-5">
                <path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-semibold tracking-tightish text-slate-900 text-[14px]">
              VitalCV<span className="text-slate-400 font-normal">/</span><span className="text-slate-500 font-normal">career</span>
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-1" role="tablist" aria-label="Career OS">
            {W245_SECTIONS.map(s => {
              const active = section === s.id;
              return (
                <button key={s.id} role="tab" aria-selected={active}
                  onClick={() => go245(s.id, entityId)}
                  className={cn('group relative px-3 h-9 rounded-md text-[12.5px] font-medium transition-colors flex items-center gap-2',
                    active ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50')}>
                  <s.Icon size={14} className={active ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-500'} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <Icon.ShieldCheck size={14} className="text-emerald-600" />
            <span>Owned ledger · portable</span>
          </span>
          <Button size="sm" variant="outline" iconLeft={<Icon.Download size={13} />}>Export receipt</Button>
        </div>
      </div>
      {/* Mobile tabs */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto scroll-thin" role="tablist">
        {W245_SECTIONS.map(s => {
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => go245(s.id, entityId)}
              className={cn('px-3 h-8 rounded-md text-[12px] font-medium whitespace-nowrap flex items-center gap-1.5',
                active ? 'text-slate-900 bg-slate-100' : 'text-slate-500')}>
              <s.Icon size={13} /><span>{s.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const W245_ENTITIES = { 'macie-miller': window.ENTITY };

function W245App() {
  const { section, entityId } = useRoute245();
  const entity = W245_ENTITIES[entityId] || window.ENTITY;

  React.useEffect(() => {
    if (!window.location.hash) window.location.replace('#/career/macie-miller');
  }, []);

  let View = ViewHome;
  if (section === 'evidence') View = ViewEvidence;
  else if (section === 'timeline') View = ViewTimeline;
  else if (section === 'trust') View = ViewTrust;

  return (
    <div className="min-h-screen bg-slate-100">
      <W245Chrome section={section} entityId={entityId} entity={entity} />
      <main key={section} className="pb-16">
        <View entity={entity} />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1340px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <span>VitalCV · Career OS · Wave 245</span>
          <span className="hidden sm:inline">who am i · what exists · what's missing · how trusted · what next</span>
          <span>vc.2026.06.21 · w245 · v1</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<W245App />);
