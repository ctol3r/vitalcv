// WAVE 1400 — root app + hash router · Healthcare Operations Engine

const VIEW_FOR = {
  operations: ViewOperations,
  queues:     ViewQueues,
  command:    ViewCommand,
  timeline:   ViewTimeline,
  executive:  ViewExecutive,
};

let _hbStarted = false;

function App() {
  const { surface } = useRoute();
  const { accent, def } = useWorkspace();
  useAccentTheme(accent);
  React.useEffect(() => { if (!window.location.hash) window.location.replace('#/operations'); }, []);
  React.useEffect(() => { if (!_hbStarted) { _hbStarted = true; startHeartbeat(); } }, []);
  const View = VIEW_FOR[surface] || ViewOperations;
  return (
    <div className="min-h-screen" style={{ background: '#0b0e13' }}>
      <TopChrome surface={surface} />
      <main className="pb-16">
        <View />
      </main>
      <RecordDrawer />
      <footer className="border-t border-white/[0.07]">
        <div className="max-w-[1560px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-600">
          <span>VitalCV · Operations Engine · Wave 1400</span>
          <span className="hidden md:inline">{def.name}</span>
          <span>vc.2026.06.27 · w1400 · v1</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
