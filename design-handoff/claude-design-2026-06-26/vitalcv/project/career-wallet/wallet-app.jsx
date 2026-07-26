// ════════════════════════════════════════════════════════════════════════
// CAREER WALLET — app shell + hash router
// ════════════════════════════════════════════════════════════════════════

const ROUTE_BY_HASH = Object.fromEntries(NAV.map(n => [n.route, n.id]));
const HASH_BY_ID = Object.fromEntries(NAV.map(n => [n.id, n.route]));

function readRoute() {
  const h = (location.hash || '').replace(/^#/, '');
  if (ROUTE_BY_HASH[h]) return ROUTE_BY_HASH[h];
  try { const s = localStorage.getItem('vcv.wallet.route'); if (s && NAV.some(n => n.id === s)) return s; } catch (_) {}
  return 'home';
}

function WalletApp() {
  const [active, setActive] = React.useState(readRoute);

  React.useEffect(() => {
    const onHash = () => setActive(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const nav = (id) => {
    setActive(id);
    try { localStorage.setItem('vcv.wallet.route', id); } catch (_) {}
    if (location.hash !== '#' + HASH_BY_ID[id]) {
      history.pushState(null, '', '#' + HASH_BY_ID[id]);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    const main = document.getElementById('wallet-main');
    if (main) main.scrollTop = 0;
  };

  React.useEffect(() => {
    if (location.hash !== '#' + HASH_BY_ID[active]) {
      history.replaceState(null, '', '#' + HASH_BY_ID[active]);
    }
  }, []);

  const View = {
    home: ViewHome, evidence: ViewEvidence, timeline: ViewTimeline,
    trust: ViewTrust, share: ViewShare,
  }[active] || ViewHome;

  return (
    <div className="flex min-h-screen bg-[#f7f8fa]">
      <Sidebar active={active} onNav={nav} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* top scenario strip */}
        <div className="bg-slate-900 text-slate-300 text-[11px] sticky top-0 z-30">
          <div className="px-6 lg:px-9 h-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="mono uppercase tracking-[0.14em] text-slate-400">Career Wallet</span>
              <span className="text-slate-600">·</span>
              <span className="hidden sm:inline">Wave 250 · clinician-facing MVP</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="hidden md:inline">Env <span className="mono text-slate-200">sandbox</span></span>
              <span className="h-3 w-px bg-slate-700 hidden md:inline-block" />
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-soft" /><span className="mono text-slate-300">vc.2026.06.21</span></span>
            </div>
          </div>
        </div>

        <MobileNav active={active} onNav={nav} />

        <main id="wallet-main" className="flex-1 px-6 lg:px-9 py-8 max-w-[1180px] w-full mx-auto">
          <View onNav={nav} />
          <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 mono text-[10.5px] uppercase tracking-[0.1em] text-slate-400">
            <span>VitalCV · Career Wallet · {W.CLINICIAN.walletId}</span>
            <span>Owned ledger · projected, never stored · <span className="text-slate-600">credibility, not attention</span></span>
          </footer>
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<WalletApp />);
