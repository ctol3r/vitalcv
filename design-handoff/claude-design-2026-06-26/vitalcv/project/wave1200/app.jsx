// WAVE 1200 — Professional Reasoning Engine · root app + hash router
// Surfaces: #/graph · #/search · #/explore · #/path · #/scenarios · #/studio

const VIEW_FOR = {
  graph: ViewGraph,
  search: ViewSearch,
  explore: ViewExplore,
  path: ViewPath,
  scenarios: ViewScenarios,
  studio: ViewStudio,
};

function App() {
  const { surface } = useRoute();
  React.useEffect(() => { if (!window.location.hash) window.location.replace('#/graph'); }, []);
  const View = VIEW_FOR[surface] || ViewGraph;
  return (
    <div className="min-h-screen" style={{ background: '#0b0e13' }}>
      <TopChrome surface={surface} />
      <main className="pb-14">
        <View />
      </main>
      <footer className="border-t border-white/[0.07]">
        <div className="max-w-[1480px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-600">
          <span>VitalCV · Professional Reasoning Engine · Wave 1200</span>
          <span className="hidden md:inline">search · explore · path · scenarios · studio</span>
          <span>vc.2026.06.27 · w1200 · v1</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
