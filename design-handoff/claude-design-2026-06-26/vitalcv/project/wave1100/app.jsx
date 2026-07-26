// WAVE 1100 — Professional Knowledge Graph · root app + hash router
// Surfaces: #/graph · #/explorer · #/dna · #/model

const VIEW_FOR = {
  graph: ViewGraph,
  explorer: ViewExplorer,
  dna: ViewDNA,
  model: ViewModel,
};

function App() {
  const { surface } = useRoute();

  React.useEffect(() => {
    if (!window.location.hash) window.location.replace('#/graph');
  }, []);

  const View = VIEW_FOR[surface] || ViewGraph;

  return (
    <div className="min-h-screen bg-slate-100">
      <TopChrome surface={surface} />
      <main className="pb-16">
        <View />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <span>VitalCV · Professional Knowledge Graph · Wave 1100</span>
          <span className="hidden sm:inline">graph · explorer · career dna · entity model</span>
          <span>vc.2026.06.27 · w1100 · v1</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
